/**
 * The Prefix-caching section's figures of what came before a request: the hit ratio after a gap of each length, how
 * long a gap is by what it waited for, the mean hit ratio by the same, the hit ratio after the context was appended
 * to or rewritten, and how often each kind of rewrite happens. A request's gap is the wait since the previous request
 * of its session ended, of 0 s or more, with what it waited for; the queries pick those requests.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines; `caching.js` lists them with the section's other
 * figures. A cause, a transition and a gap bin have the same colour in every chart, from `theme/colours.js`.
 */

import { AXIS_STYLE, chartFrame, colourScale, drawCdf, TIP_STYLE } from "../shared/charts.js";
import { durationTicks, fewerOnNarrow } from "../axes/ticks.js";
import { causeColours, GAP_BIN_SLOTS, TRANSITION_COLOURS } from "../theme/colours.js";
import {
  formatCount, formatDurationTick, formatPercent, formatSeconds, formatShare, MISSING_TEXT,
} from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";

// The gap bins' labels, shortest gap first, as the pipeline's `gaps.GAP_BINS` names them. tests/
// test_pipeline_mirrors_caching.py checks them, the cause names and the three constants below against the pipeline.
const GAP_BIN_LABELS = Object.freeze(["<1m", "1–5m", "5–15m", "15–30m", "30m–1h", ">1h"]);
// How a legend and a tooltip write each gap bin, in the words every duration is written in.
const GAP_BIN_TEXT = Object.freeze({
  "<1m": "Under 1 min", "1–5m": "1–5 min", "5–15m": "5–15 min", "15–30m": "15–30 min", "30m–1h": "30 min–1 h",
  ">1h": "Over 1 h",
});

// What a gap waited for, by the release's `waited_for` value in the order of the pipeline's `gaps.CAUSE_NAMES`, named
// in sentence case as Session time by part names its parts.
const CAUSE_NAMES = Object.freeze({
  tool: "Tool wait",
  ask_user_tool: "Ask-user tool",
  user: "User idle",
  subagent: "Subagent",
});

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
const SHARE_DIGITS = 2; // every share of the table has two decimals, as the paper writes steps: a cause can be 0.04%

const MIN_GAP_DRAWN_S = 0.1; // a shorter gap is drawn at it, on the log axis, as in the paper
const MAX_GAP_DRAWN_S = 86400; // the gap axis ends at a day, as the paper's does
const MEAN_HIT_RATIO_AXIS_LOW = 0.7; // the bars start here, as in the paper, so their differences show

const HIT_RATIO_DOMAIN = Object.freeze([0, 1]); // a hit ratio runs from none of the input cached to all of it
const CAUSE_MARGIN_LEFT = 116; // pixels; room for the longest cause name, "Ask-user tool"
const VALUE_MARGIN_RIGHT = 48; // pixels; room for a value written after a bar that reaches 1, "100%"
const VALUE_OFFSET = 4; // pixels between a bar's end and its value
const BAR_INSET = 1; // pixels taken off each side of a bar: a 2px gap between neighbouring bars

/** The gap figures of the Prefix-caching section, by name. */
export const GAP_FIGURES = Object.freeze({
  hitRatioByGapBin: Object.freeze({
    name: "hit_ratio_cdf_by_gap_bin",
    title: "Hit ratio by gap before the request",
    definition: "CDF of the hit ratio (cached over input tokens) of requests in each of six bins of the gap before them, the wait since their session's previous request ended, shortest gap lightest.",
    caption: "Hit ratio of each request, by its gap since the previous one.",
    drawsLines: true,
    query: "figures/hit_ratio_cdf_by_gap_bin",
    binColumn: "series",
    seriesColumn: "series",
    legend: gapBinLegend,
    draw: drawHitRatioByGapBin,
  }),
  gapByCause: Object.freeze({
    name: "gap_cdf_by_cause",
    title: "Gap before a request by cause",
    definition: "CDF of the gap before a request (the wait since the previous request of its session ended) by what it waited for, a gap under 0.1 s drawn at 0.1 s, on an axis that ends at a day.",
    caption: "Gap before each request, by what it waited for.",
    drawsLines: true,
    query: "figures/gap_cdf_by_cause",
    binColumn: "series",
    seriesColumn: "series",
    legend: causeLegend,
    draw: drawGapByCause,
  }),
  meanHitRatioByCause: Object.freeze({
    name: "mean_hit_ratio_by_cause",
    title: "Mean hit ratio by cause",
    definition: "Mean hit ratio (cached over input tokens) of requests by what the gap before them waited for, each bar starting at 70%, where a mean below 70% is drawn ending there, its value written beside it.",
    caption: "Mean hit ratio of requests, by what the gap before waited for.",
    query: "figures/mean_hit_ratio_by_cause",
    binColumn: "waited_for",
    draw: drawMeanHitRatioByCause,
  }),
  mutationsByCause: Object.freeze({
    name: "mutations_by_cause",
    title: "Context mutations by cause",
    definition: "Per transition and mutation cause, over top-level requests after their session's first, model and provider switches left out: its share of steps, of sessions having one (for appends, having no mutation), and of simulated tokens missed with no TTL.",
    caption: "How often each kind of context change happens, and its prefill.",
    query: "figures/mutations_by_cause",
    binColumn: null,
    seriesOverSameRows: true,
    isPartlySimulated: true,
    draw: drawMutationsByCause,
  }),
  hitRatioByTransition: Object.freeze({
    name: "hit_ratio_cdf_by_transition",
    title: "Hit ratio after a context change",
    definition: "CDF of the hit ratio (cached over input tokens) of requests that append to the context before them and of those that rewrite it (a mutation); requests that switch model or provider are not drawn, as in the paper.",
    caption: "Hit ratio of requests that append to the context or rewrite it.",
    drawsLines: true,
    query: "figures/hit_ratio_cdf_by_transition",
    binColumn: "series",
    seriesColumn: "series",
    legend: transitionLegend,
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

/** The gap-bin figure's legend: the bins of the rows, shortest gap first. */
export function gapBinLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, gapBinColours(), GAP_BIN_TEXT);
}

/** The gap-by-cause figure's legend: the causes of the rows, in the paper's order, by the paper's names. */
export function causeLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, causeColours(), CAUSE_NAMES);
}

/** The transition figure's legend: appends, then mutations, each in its transition colour. */
export function transitionLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, new Map(Object.entries(TRANSITION_COLOURS)), TRANSITION_NAMES);
}

/**
 * The mean-hit-ratio bars, one per cause of `rows` in the paper's order: `{ cause, name, end, mean, rows }`, each bar
 * ending at its mean, or at the axis's low end when its mean is below it, so the bar stays on the axis.
 */
export function meanHitRatioBars(rows) {
  const bars = [];
  for (const [cause, name] of Object.entries(CAUSE_NAMES)) {
    const row = rows.find((candidate) => candidate.waited_for === cause);
    if (row !== undefined) {
      const end = Math.max(row.mean_hit_ratio, MEAN_HIT_RATIO_AXIS_LOW);
      bars.push({ cause, name, end, mean: row.mean_hit_ratio, rows: row.rows });
    }
  }
  return bars;
}

/**
 * The lines of the mutation table, one per row of `rows` in the table's order: `{ name, isCause, cells }`, `cells` the
 * row's name and its shares of steps, sessions and prefill as percentages with two decimals and no sign, "—" for a
 * share of nothing.
 */
export function mutationTableLines(rows) {
  const lines = [];
  for (const [name, label] of Object.entries(MUTATION_TABLE_ROWS)) {
    const row = rows.find((candidate) => candidate.table_row === name);
    if (row !== undefined) {
      const shares = [percentText(row.steps_share, SHARE_DIGITS), percentText(row.sessions_share, SHARE_DIGITS),
        percentText(row.prefill_share, SHARE_DIGITS)];
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
      <th>Transition</th><th class="is-number">Steps %</th>
      <th class="is-number">Sessions %</th><th class="is-number">Prefill %</th>
    </tr></thead>
    <tbody></tbody>`;
  for (const line of mutationTableLines(rows)) {
    table.tBodies[0].append(mutationTableRow(line));
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  body.replaceChildren(wrap);
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

/** Draw one CDF line of the hit ratio per gap bin. */
async function drawHitRatioByGapBin(rows, body, colours) {
  const series = cdfSeries(rows, GAP_BIN_LABELS, { labels: GAP_BIN_TEXT });
  await drawCdf(body, series, {
    xLabel: "Hit ratio", xDomain: HIT_RATIO_DOMAIN, xTickFormat: formatPercent, format: formatShare,
    colours: colours.series,
  });
}

/** Draw one CDF line of the gap per cause, on a log axis of seconds from 0.1 s to a day. */
async function drawGapByCause(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(CAUSE_NAMES), { labels: CAUSE_NAMES, floor: MIN_GAP_DRAWN_S });
  const xDomain = [MIN_GAP_DRAWN_S, MAX_GAP_DRAWN_S];
  const ticks = durationTicks(xDomain);
  await drawCdf(body, series, {
    logX: true,
    xDomain,
    xTicks: fewerOnNarrow(ticks, chartFrame(body).width),
    xTickFormat: formatDurationTick,
    format: formatSeconds,
    colours: colours.series,
  });
}

/** Draw one CDF line of the hit ratio per transition. */
async function drawHitRatioByTransition(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TRANSITION_NAMES), { labels: TRANSITION_NAMES });
  await drawCdf(body, series, {
    xLabel: "Hit ratio", xDomain: HIT_RATIO_DOMAIN, xTickFormat: formatPercent, format: formatShare,
    colours: colours.series,
  });
}

/**
 * Draw one horizontal bar per cause from the axis's low end to its mean hit ratio, its value written after it as a
 * percentage; the values stand in for an x axis.
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
    x: { domain: [MEAN_HIT_RATIO_AXIS_LOW, 1], axis: null },
    y: { type: "band", domain: causes },
    color: colourScale(causeColours(), causes),
    marks: [
      Plot.axisY({ ...AXIS_STYLE, label: null, tickFormat: (cause) => CAUSE_NAMES[cause] }),
      Plot.barX(bars, { x1: MEAN_HIT_RATIO_AXIS_LOW, x2: "end", y: "cause", fill: "cause", inset: BAR_INSET }),
      Plot.text(bars, {
        x: "end", y: "cause", text: meanText, textAnchor: "start", dx: VALUE_OFFSET, fill: "var(--chart-label)",
      }),
      Plot.tip(bars, Plot.pointerY({ ...TIP_STYLE, x: "end", y: "cause", title: meanTipText })),
    ],
  });
  body.replaceChildren(chart);
}

function meanText(bar) {
  return formatPercent(bar.mean);
}

function meanTipText(bar) {
  return `${bar.name}\nmean hit ratio ${formatShare(bar.mean)}\n${formatCount(bar.rows)} requests`;
}

// A share as its percentage, without the sign, which the table's headers carry; "—" for a share of nothing.
function percentText(share, digits) {
  return share === null ? MISSING_TEXT : (share * 100).toFixed(digits);
}
