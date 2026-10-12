/**
 * The Human-driven-against-benchmark CDFs of turn duration, session duration, input per request and user prompt tokens:
 * each a CDF per scope, human-driven and benchmark, each median marked with its value and a dotted line between the two
 * medians, as the paper draws them; the legend gives both medians and their ratio, the larger over the smaller. The
 * first three are listed in `comparison.js`, the user prompt size in the Sessions section (`figures/sessions.js`).
 *
 * Every row of their queries is one CDF point of one scope: `series` (the scope, by the pipeline's name of it), `x` and
 * `share`; the same on every row of a scope, `rows` (what the scope's CDF is over) and `median`; and the same on every
 * row, `median_ratio`. A scope with too few rows is hidden whole, and a hidden scope's rows are left out before a chart
 * is drawn.
 */

import {
  AXIS_STYLE, cdfPoints, chartFrame, colourScale, GRID_STYLE, legendPlace, LINE_WIDTH, TIP_STYLE, X_INSET,
} from "../shared/charts.js";
import { axisWithTicks, isNarrowChart } from "../axes/ticks.js";
import {
  formatDurationTick, formatMultiple, formatPercent, formatSeconds, formatShare, formatTokens,
} from "../shared/format.js";
import { cdfSeries } from "../figures/figure_rows.js";
import { SCOPE_LABELS, scopeLegend, SCOPES } from "./scopes.js";

const MIN_DURATION_DRAWN_S = 1; // the pipeline's comparison.MIN_DURATION_DRAWN_S: a shorter turn or session is drawn at it
const MIN_INPUT_DRAWN = 1000; // comparison.MIN_INPUT_DRAWN: the input axis starts at 1k
const MIN_PROMPT_DRAWN = 1; // comparison.MIN_PROMPT_DRAWN: the user prompt axis starts at one token

const MEDIAN_SHARE = 0.5; // the share at which a CDF crosses its median
const MEDIAN_RADIUS = 3; // pixels; the dot on each median
const MEDIAN_LABEL_OFFSET = 8; // pixels from a median's dot to its label, along each axis
const RATIO_DECIMALS = 1; // the ratio of the medians as the paper writes it: 3.1×
const MEDIAN_LINK_DASH = "1 3"; // the dotted line between the medians
// A median's label: in the chart's ink, ringed in the card's colour so that a line it crosses does not cut its text.
const MEDIAN_LABEL_STYLE = Object.freeze({
  fill: "currentColor", stroke: "var(--color-surface)", strokeWidth: 3, paintOrder: "stroke",
});

// Each figure's x axis, from the pipeline's floor to the paper's end, its ticks (at most six) and, where they differ, its
// ticks on a narrow chart, how they are written, how a value is written in a median's label, the legend and the
// tooltip, and what the CDF counts.
const TURN_DURATION_AXIS = Object.freeze({
  floor: MIN_DURATION_DRAWN_S,
  end: 86400, // a day
  ticks: Object.freeze([1, 60, 3600, 86400]),
  tickFormat: formatDurationTick,
  valueFormat: formatSeconds,
  noun: "turns",
});
const SESSION_DURATION_AXIS = Object.freeze({
  floor: MIN_DURATION_DRAWN_S,
  end: 604800, // a week
  ticks: Object.freeze([1, 60, 3600, 86400, 604800]),
  narrowTicks: Object.freeze([1, 60, 3600, 86400]), // on a phone "1 d" and "7 d" would touch
  tickFormat: formatDurationTick,
  valueFormat: formatSeconds,
  noun: "sessions",
});
const INPUT_AXIS = Object.freeze({
  floor: MIN_INPUT_DRAWN,
  end: 1e6,
  ticks: Object.freeze([1e3, 1e4, 1e5, 1e6]),
  tickFormat: formatTokens,
  valueFormat: formatTokens,
  noun: "requests",
});
const PROMPT_AXIS = Object.freeze({
  floor: MIN_PROMPT_DRAWN,
  end: 1e5,
  ticks: Object.freeze([1, 10, 100, 1e3, 1e4, 1e5]),
  narrowTicks: Object.freeze([1, 100, 1e4]), // on a phone six labels would touch
  tickFormat: formatTokens,
  valueFormat: formatTokens,
  noun: "prompts",
});

/** The turn duration figure entry, whose fields CONTRIBUTING.md defines. */
export const TURN_DURATION_BY_SCOPE = Object.freeze({
  name: "turn_duration_by_scope",
  title: "Turn duration",
  definition: "CDF of the duration of a turn (a user step and the tool steps after it, first start to last end) of the top-level sessions of the paper's harnesses and of the benchmark's, each median marked and their ratio written, the larger over the smaller.",
  caption: "How long a turn lasts, human-driven and benchmark.",
  drawsLines: true,
  query: "figures/turn_duration_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven turns", "SWE-Bench": "benchmark turns" }),
  legend: scopeLegend,
  draw: drawTurnDurations,
});

/** The session duration figure entry. */
export const SESSION_DURATION_BY_SCOPE = Object.freeze({
  name: "session_duration_by_scope",
  title: "Session duration",
  definition: "CDF of the duration of a top-level session (its first request's start to its last request's end) of the paper's harnesses and of the benchmark's, each median marked and their ratio written, the larger over the smaller.",
  caption: "How long a session lasts, human-driven and benchmark.",
  drawsLines: true,
  query: "figures/session_duration_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven sessions", "SWE-Bench": "benchmark sessions" }),
  legend: scopeLegend,
  draw: drawSessionDurations,
});

/** The input per request figure entry. */
export const INPUT_PER_REQUEST_BY_SCOPE = Object.freeze({
  name: "input_per_request_by_scope",
  title: "Input per request",
  definition: "CDF of the input tokens of a request of the top-level sessions of the paper's harnesses and of the benchmark's, over the requests whose input is reported, each median marked and their ratio written, the larger over the smaller.",
  caption: "Input tokens of each request, human-driven and benchmark.",
  drawsLines: true,
  isWide: true,
  query: "figures/input_per_request_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven requests", "SWE-Bench": "benchmark requests" }),
  legend: scopeLegend,
  draw: drawInputPerRequest,
});

/** The user prompt figure entry. */
export const USER_PROMPT_TOKENS_BY_SCOPE = Object.freeze({
  name: "user_prompt_tokens_by_scope",
  title: "User prompt size",
  definition: "CDF of the tokens of a user's new prompt (a user step's rise in user tokens over the step before, all of them at a session's first step; a step whose user tokens did not rise has none) of the top-level sessions of the paper's harnesses and of the benchmark's, each median marked and their ratio written, the larger over the smaller.",
  caption: "Tokens of each new user prompt, human-driven and benchmark.",
  drawsLines: true,
  query: "figures/user_prompt_tokens_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven prompts", "SWE-Bench": "benchmark prompts" }),
  legend: scopeLegend,
  draw: drawUserPromptTokens,
});

/**
 * The medians of the scopes the rows hold, smallest first: `[{ series, median, x }]`, `median` the scope's own and `x`
 * where it is drawn, raised to `floor` as its CDF is.
 */
export function scopeMedians(rows, floor) {
  const medians = new Map();
  for (const row of rows) {
    medians.set(row.series, row.median);
  }
  const drawn = [];
  for (const series of SCOPES) {
    if (medians.has(series)) {
      drawn.push({ series, median: medians.get(series), x: Math.max(medians.get(series), floor) });
    }
  }
  return drawn.sort((first, second) => first.median - second.median);
}

/**
 * The legend's summary of the medians, human-driven against benchmark, each as `format` writes it, and their ratio:
 * "median 61 s vs 3.1 min · 3.1×"; "" unless the rows hold both scopes and a ratio.
 */
export function medianSummary(rows, format) {
  const ratio = medianRatioText(rows);
  if (ratio === null) {
    return "";
  }
  const medians = new Map(rows.map((row) => [row.series, row.median]));
  const values = SCOPES.map((series) => format(medians.get(series)));
  return `median ${values.join(" vs ")} · ${ratio}`;
}

/**
 * The ratio of the medians as it is written, "3.1×", when the rows hold both scopes and a finite ratio (the query has
 * none when the smaller median is zero); else null.
 */
export function medianRatioText(rows) {
  const present = new Set(rows.map((row) => row.series));
  if (SCOPES.some((series) => !present.has(series)) || !Number.isFinite(rows[0].median_ratio)) {
    return null;
  }
  return formatMultiple(rows[0].median_ratio, RATIO_DECIMALS);
}

/** Draw the turn duration CDFs, in seconds on a log axis. */
async function drawTurnDurations(rows, body, colours) {
  await drawScopeCdf(rows, body, colours, TURN_DURATION_AXIS);
}

/** Draw the session duration CDFs, in seconds on a log axis. */
async function drawSessionDurations(rows, body, colours) {
  await drawScopeCdf(rows, body, colours, SESSION_DURATION_AXIS);
}

/** Draw the input per request CDFs, in tokens on a log axis. */
async function drawInputPerRequest(rows, body, colours) {
  await drawScopeCdf(rows, body, colours, INPUT_AXIS);
}

/** Draw the user prompt CDFs, in tokens on a log axis. */
async function drawUserPromptTokens(rows, body, colours) {
  await drawScopeCdf(rows, body, colours, PROMPT_AXIS);
}

/**
 * Draw one CDF per scope of the rows on `axis`, a log axis from its floor to its end, each scope in its legend's
 * colour, with the medians, the dotted line between them and their ratio.
 */
async function drawScopeCdf(rows, body, colours, axis) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const series = cdfSeries(rows, SCOPES, { labels: SCOPE_LABELS, floor: axis.floor });
  const points = cdfPoints(series);
  const frame = chartFrame(body);
  const ticks = isNarrowChart(frame.width) ? (axis.narrowTicks ?? axis.ticks) : axis.ticks;
  showMedianSummary(body, medianSummary(rows, axis.valueFormat));
  const chart = Plot.plot({
    ...frame,
    x: { type: "log", domain: [axis.floor, axis.end], inset: X_INSET },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, series.map((one) => one.name)),
    marks: [
      Plot.gridX(ticks, GRID_STYLE),
      Plot.gridY(GRID_STYLE),
      axisWithTicks(Plot.axisX, ticks, { ...AXIS_STYLE, tickFormat: axis.tickFormat, label: null }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: `Share of ${axis.noun}` }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH, clip: true }),
      ...medianMarks(Plot, rows, axis),
      Plot.tip(points, Plot.pointerX({ ...TIP_STYLE, x: "x", y: "share", title: (point) => tipText(point, axis) })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The marks of the medians: a dot on each, the smaller's value above it to the left and the larger's below it to the
 * right, as the paper places them; with both scopes, the dotted line between them, whose ratio the legend gives.
 */
function medianMarks(Plot, rows, axis) {
  const medians = scopeMedians(rows, axis.floor);
  const marks = [
    Plot.dot(medians, { x: "x", y: MEDIAN_SHARE, fill: "series", r: MEDIAN_RADIUS }),
    Plot.text(medians.slice(0, 1), {
      ...MEDIAN_LABEL_STYLE, x: "x", y: MEDIAN_SHARE, text: (median) => axis.valueFormat(median.median),
      textAnchor: "end", dx: -MEDIAN_LABEL_OFFSET, dy: -MEDIAN_LABEL_OFFSET,
    }),
    Plot.text(medians.slice(1), {
      ...MEDIAN_LABEL_STYLE, x: "x", y: MEDIAN_SHARE, text: (median) => axis.valueFormat(median.median),
      textAnchor: "start", dx: MEDIAN_LABEL_OFFSET, dy: MEDIAN_LABEL_OFFSET,
    }),
  ];
  if (medianRatioText(rows) !== null) {
    marks.push(
      Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, x1: medians[0].x, x2: medians[1].x, strokeDasharray: MEDIAN_LINK_DASH }),
    );
  }
  return marks;
}

/** Write `text` as the last item of the legend above `body`, in place of the one an earlier drawing wrote. */
function showMedianSummary(body, text) {
  const legend = legendPlace(body);
  legend.querySelector(".legend-note")?.remove();
  if (text !== "") {
    const note = document.createElement("span");
    note.className = "legend-item legend-note";
    note.textContent = text;
    legend.append(note);
  }
}

function tipText(point, axis) {
  return `${point.label}\n${axis.valueFormat(point.x)}\n${formatShare(point.share)} of ${axis.noun}`;
}
