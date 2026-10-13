/**
 * The Prefix-caching section's figures of what came before a request: the hit ratio after a gap of each length, how
 * long a gap is by what it waited for, the mean hit ratio by the same, the hit ratio after the context was appended
 * to or rewritten, and how often each kind of rewrite happens. A request's gap is the wait since the previous request
 * of its session ended, of 0 s or more, with what it waited for; the queries pick those requests.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines; `caching.js` lists them with the section's other
 * figures. A cause, a transition and a gap bin have the same colour in every chart, from `theme/colours.js`.
 */

import { AXIS_STYLE, BAR_INSET, chartFrame, colourScale, TALL_CHART_HEIGHT } from "../shared/charts.js";
import { drawCdfSeries } from "../shared/cdf.js";
import { cdfSeries } from "../charts/cdf.js";
import { durationTicks, fewerOnNarrow } from "../axes/ticks.js";
import { CAUSE_COLOURS, GAP_BIN_SLOTS, TIME_PART_NAMES, TRANSITION_COLOURS } from "../theme/colours.js";
import {
  formatCount, formatDurationTick, formatPercent, formatSeconds, formatShare, MISSING_TEXT,
} from "../shared/format.js";
import { seriesLegend } from "./figure_rows.js";

// The gap bins' labels, shortest gap first, as the pipeline's `gaps.GAP_BINS` names them. tests/
// test_pipeline_mirrors_caching.py checks them, the causes and the two gap limits below against the pipeline.
const GAP_BIN_LABELS = Object.freeze(["<1m", "1–5m", "5–15m", "15–30m", "30m–1h", ">1h"]);
// How a legend and a tooltip write each gap bin, in the words every duration is written in.
const GAP_BIN_TEXT = Object.freeze({ "<1m": "Under 1 min", "1–5m": "1–5 min", "5–15m": "5–15 min",
  "15–30m": "15–30 min", "30m–1h": "30 min–1 h", ">1h": "Over 1 h" });

// What a gap waited for, by the release's `waited_for` value in the order of the pipeline's `gaps.CAUSE_NAMES`, in
// sentence case: a wait for a tool and for the user named as the parts of a session's time they count toward.
const CAUSE_NAMES = Object.freeze({
  tool: TIME_PART_NAMES.tool, ask_user_tool: "Ask-user tool", user: TIME_PART_NAMES.user, subagent: "Subagent",
});

// The colour of each cause, by its `waited_for` value in the order of `CAUSE_NAMES`, as the charts take colours.
const CAUSE_COLOUR_MAP = new Map(Object.entries(CAUSE_COLOURS));

// The transitions the figure draws, in their order, with the names it draws them under. A switch to another model or
// provider is routing, not a change of context, and is not drawn, as in the paper.
const TRANSITION_NAMES = Object.freeze({ append: "Append", mutation: "Mutation" });

// The rows of the mutation table, in its order, as the pipeline's `mutations.TABLE_ROWS` names them: the transitions,
// then each cause of a mutation, which the table sets under them, indented.
const MUTATION_TABLE_ROWS = Object.freeze({
  append: "Append", mutation: "Mutation", injection: "Injection", system_prompt: "System prompt",
  tool_definitions: "Tool definitions", dropped_turns: "Dropped turns", compaction: "Compaction",
  tool_result: "Tool result drop", other: "Other",
});
const SMALLEST_SHARE_WRITTEN = 0.001; // a share of the table under 0.1% is written "<0.1%", not rounded to nothing

const MIN_GAP_DRAWN_S = 0.1; // a shorter gap is drawn at it, on the log axis, as in the paper
const MAX_GAP_DRAWN_S = 86400; // the gap axis ends at a day, as the paper's does
const HIT_RATIO_DOMAIN = Object.freeze([0, 1]); // a hit ratio runs from none of the input cached to all of it
// The shortest and longest gap bins, named off the lines: the longest above its line, where no line lies above it; the
// shortest, which hugs the axis under the others, beside its right end at a share of 10%, where it rises alone.
const GAP_BIN_END_LABELS = Object.freeze([{ name: "<1m", at: 0.1, placement: "end" }, { name: ">1h", at: 0.5, placement: "above" }]);
const CAUSE_MARGIN_LEFT = 116; // pixels; room for the longest cause name, "Ask-user tool"
const VALUE_MARGIN_RIGHT = 48; // pixels; room for a value written after a bar that reaches 1, "100%"
const VALUE_OFFSET = 4; // pixels between a bar's end and its value

/** The gap figures of the Prefix-caching section, by name. */
export const GAP_FIGURES = Object.freeze({
  hitRatioByGapBin: Object.freeze({
    name: "hit_ratio_cdf_by_gap_bin",
    title: "Cache hits after a wait",
    insight: "Taking a break can turn reused context into fresh work.",
    definition: "Each line groups requests by how long they waited after the previous request ended. It shows the percentage of requests at or below each cache hit ratio: cached input tokens divided by total input tokens. Lighter lines show shorter waits.",
    caption: "Prefix reuse stays high when requests arrive within one minute, but falls to roughly 58% after 15–30 minutes and just 18% after gaps longer than an hour.",
    drawsLines: true,
    query: "figures/hit_ratio_cdf_by_gap_bin",
    binColumn: "series",
    seriesColumn: "series",
    legend: (rows, colours, seriesColumn) => seriesLegend(rows, seriesColumn, gapBinColours(), GAP_BIN_TEXT),
    draw: drawHitRatioByGapBin,
  }),
  gapByCause: Object.freeze({
    name: "gap_cdf_by_cause",
    title: "Gap before a request by cause",
    insight: "Human pauses are far longer than routine tool execution.",
    definition: "Each line shows the percentage of waits that end within the time shown, grouped by what the session waited for. Wait time is measured from one request’s end to the next request’s start. Waits below 0.1 seconds are shown at 0.1 seconds.",
    caption: "Ordinary tool gaps last a median of 1.8 seconds, compared with 96.5 seconds between user turns. Subagents and tools requesting human input introduce additional long waits.",
    drawsLines: true,
    query: "figures/gap_cdf_by_cause",
    binColumn: "series",
    seriesColumn: "series",
    legend: (rows, colours, seriesColumn) => seriesLegend(rows, seriesColumn, CAUSE_COLOUR_MAP, CAUSE_NAMES),
    draw: drawGapByCause,
  }),
  meanHitRatioByCause: Object.freeze({
    name: "mean_hit_ratio_by_cause",
    title: "Cache reuse by wait type",
    insight: "Cache reuse suffers most when control returns to the user.",
    definition: "The average percentage of input tokens read from cache, grouped by what the session waited for before the request. For each request, this percentage is cached input divided by total input.",
    caption: "Ordinary tool calls preserve an average cache-hit ratio of 97.5%, compared with just 84% following user idle periods. Subagent and Ask User waits also reduce reuse.",
    query: "figures/mean_hit_ratio_by_cause",
    binColumn: "waited_for",
    draw: drawMeanHitRatioByCause,
  }),
  mutationsByCause: Object.freeze({
    name: "mutations_by_cause",
    title: "Context mutations by cause",
    insight: "Rare context changes are responsible for most recomputation.",
    definition: "The table shows how often each change occurs and its percentage of uncached input processing, assuming the cache never expires. Append adds messages; mutation changes earlier messages. First requests and model or provider switches are excluded; session percentages count sessions with each change, except Append counts sessions with no mutations.",
    caption: "Only 4% of request transitions modify earlier context, yet these mutations account for 62.5% of fresh prefill even under infinite cache retention.",
    query: "figures/mutations_by_cause",
    binColumn: null,
    seriesOverSameRows: true,
    isSimulation: true, // its fresh prefill shares come from the cache simulation
    draw: drawMutationsByCause,
  }),
  hitRatioByTransition: Object.freeze({
    name: "hit_ratio_cdf_by_transition",
    title: "Cache reuse after context changes",
    insight: "Rewriting old messages can invalidate an otherwise reusable context.",
    definition: "Each line shows the percentage of requests at or below each cache hit ratio: cached input divided by total input. Append means adding messages; mutation means changing earlier messages. Requests that switch model or provider are excluded.",
    caption: "Cache-hit ratios are substantially lower after context mutations than append-only steps. Changes to early content, such as system prompts or tool definitions, invalidate large portions of cached prefixes.",
    drawsLines: true,
    query: "figures/hit_ratio_cdf_by_transition",
    binColumn: "series",
    seriesColumn: "series",
    legend: (rows, colours, seriesColumn) =>
      seriesLegend(rows, seriesColumn, new Map(Object.entries(TRANSITION_COLOURS)), TRANSITION_NAMES),
    draw: drawHitRatioByTransition,
  }),
});

/** A map from each gap bin's label, shortest gap first, to its colour. */
export function gapBinColours() {
  const colours = new Map();
  for (let index = 0; index < GAP_BIN_LABELS.length; index += 1) {
    colours.set(GAP_BIN_LABELS[index], GAP_BIN_SLOTS[index]);
  }
  return colours;
}

/** The mean-hit-ratio bars, one per cause of `rows` in the paper's order: `{ cause, name, mean, rows }`. */
export function meanHitRatioBars(rows) {
  const bars = [];
  for (const [cause, name] of Object.entries(CAUSE_NAMES)) {
    const row = rows.find((candidate) => candidate.waited_for === cause);
    if (row !== undefined) {
      bars.push({ cause, name, mean: row.mean_hit_ratio, rows: row.rows });
    }
  }
  return bars;
}

/**
 * The lines of the mutation table, one per row of `rows` in the table's order: `{ name, isCause, cells }`, `cells` the
 * row's name and its shares of steps, sessions and prefill as percentages with one decimal ("96.0%", "<0.1%"), "—"
 * for a share of nothing.
 */
export function mutationTableLines(rows) {
  const lines = [];
  for (const [name, label] of Object.entries(MUTATION_TABLE_ROWS)) {
    const row = rows.find((candidate) => candidate.table_row === name);
    if (row !== undefined) {
      const shares = [row.steps_share, row.sessions_share, row.prefill_share].map(tableShareText);
      lines.push({ name, isCause: !Object.hasOwn(TRANSITION_NAMES, name), cells: [label, ...shares] });
    }
  }
  return lines;
}

/** Draw the mutation table: a row per transition, then per cause of a mutation, indented, with its three shares. */
function drawMutationsByCause(rows, body) {
  const table = document.createElement("table");
  table.className = "data-table mutation-table";
  table.innerHTML = `
    <thead><tr>
      <th>Transition</th><th class="is-number">Steps</th>
      <th class="is-number">Sessions</th><th class="is-number">Fresh prefill</th>
    </tr></thead>
    <tbody></tbody>`;
  const lines = mutationTableLines(rows);
  const firstCause = lines.find((line) => line.isCause);
  for (const line of lines) {
    if (line === firstCause) {
      table.tBodies[0].append(ofWhichRow());
    }
    table.tBodies[0].append(mutationTableRow(line));
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  body.replaceChildren(wrap);
}

/** The muted line that sets the causes of a mutation under it: "of which". */
function ofWhichRow() {
  const tableRow = document.createElement("tr");
  tableRow.className = "is-of-which";
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.textContent = "of which";
  tableRow.append(cell);
  return tableRow;
}

/** One line of the mutation table as a table row: its name, then its shares, right-aligned. */
function mutationTableRow(line) {
  const tableRow = document.createElement("tr");
  tableRow.className = line.isCause ? "is-cause" : "is-transition";
  for (let index = 0; index < line.cells.length; index += 1) {
    const cell = document.createElement("td");
    if (index > 0) {
      cell.className = "is-number";
    }
    cell.textContent = line.cells[index];
    tableRow.append(cell);
  }
  return tableRow;
}

/** Draw one CDF line of the hit ratio per gap bin, the shortest and the longest gaps named on their lines. */
async function drawHitRatioByGapBin(rows, body, colours) {
  const series = cdfSeries(rows, GAP_BIN_LABELS, { labels: GAP_BIN_TEXT });
  await drawCdfSeries(body, series, {
    xLabel: "Hit ratio", xDomain: HIT_RATIO_DOMAIN, xTickFormat: formatPercent, format: formatShare,
    colours: colours.series, lineLabels: GAP_BIN_END_LABELS,
  });
}

/** Draw one CDF line of the gap per cause, on a log axis of seconds from 0.1 s to a day. */
async function drawGapByCause(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(CAUSE_NAMES), { labels: CAUSE_NAMES, floor: MIN_GAP_DRAWN_S });
  const xDomain = [MIN_GAP_DRAWN_S, MAX_GAP_DRAWN_S];
  const ticks = durationTicks(xDomain);
  await drawCdfSeries(body, series, {
    yLabel: "Share of gaps", logX: true, xDomain, xTicks: fewerOnNarrow(ticks, chartFrame(body).width),
    xTickFormat: formatDurationTick, format: formatSeconds, colours: colours.series,
  });
}

/** Draw one CDF line of the hit ratio per transition. */
async function drawHitRatioByTransition(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TRANSITION_NAMES), { labels: TRANSITION_NAMES });
  await drawCdfSeries(body, series, {
    xLabel: "Hit ratio", xDomain: HIT_RATIO_DOMAIN, xTickFormat: formatPercent, format: formatShare,
    colours: colours.series, height: TALL_CHART_HEIGHT,
  });
}

/**
 * Draw one horizontal bar per cause from 0% to its mean hit ratio, its value written after it as a percentage; the
 * values stand in for an x axis.
 */
async function drawMeanHitRatioByCause(rows, body) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const bars = meanHitRatioBars(rows);
  const causes = bars.map((bar) => bar.cause);
  const chart = Plot.plot({
    ...chartFrame(body),
    marginLeft: CAUSE_MARGIN_LEFT,
    marginRight: VALUE_MARGIN_RIGHT,
    x: { domain: [0, 1], axis: null },
    y: { type: "band", domain: causes },
    color: colourScale(CAUSE_COLOUR_MAP, causes),
    marks: [
      Plot.axisY({ ...AXIS_STYLE, label: null, tickFormat: (cause) => CAUSE_NAMES[cause] }),
      Plot.barX(bars, { x1: 0, x2: "mean", y: "cause", fill: "cause", inset: BAR_INSET }),
      Plot.text(bars, {
        x: "mean", y: "cause", text: meanText, textAnchor: "start", dx: VALUE_OFFSET, fill: "var(--chart-label)",
      }),
      Plot.tip(bars, Plot.pointerY({ x: "mean", y: "cause", title: meanTipText })),
    ],
  });
  body.replaceChildren(chart);
}

function meanText(bar) {
  return formatShare(bar.mean);
}

function meanTipText(bar) {
  return `${bar.name}\nmean hit ratio ${formatShare(bar.mean)}\n${formatCount(bar.rows)} requests`;
}

/** A share of the mutation table: "96.0%", "<0.1%" for a share above none but under a thousandth, "—" for none. */
export function tableShareText(share) {
  if (share === null) {
    return MISSING_TEXT;
  }
  if (share > 0 && share < SMALLEST_SHARE_WRITTEN) {
    return "<0.1%";
  }
  return formatShare(share);
}
