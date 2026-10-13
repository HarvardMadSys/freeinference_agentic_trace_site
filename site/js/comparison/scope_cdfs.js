/**
 * The Human-driven-against-benchmark CDFs of turn duration, session duration, input per request and user prompt tokens:
 * each a CDF per scope, human-driven and benchmark, each median marked with its value and a dotted line between the two
 * medians, as the paper draws them; a note in the chart's lower right corner says which scope's median is the larger
 * and by how much. The
 * first three are listed in `comparison.js`, the user prompt size in the Session-structure section
 * (`figures/sessions.js`).
 *
 * Every row of their queries is one CDF point of one scope: `series` (the scope, by the pipeline's name of it), `x` and
 * `share`; the same on every row of a scope, `rows` (what the scope's CDF is over) and `median`; and the same on every
 * row, `median_ratio`. A scope with too few rows is hidden whole, and a hidden scope's rows are left out before a chart
 * is drawn.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, LINE_LABEL_STYLE, LINE_WIDTH, TIP_STYLE, X_INSET,
} from "../shared/charts.js";
import { cdfPoints } from "../shared/cdf.js";
import { axisWithTicks, isNarrowChart } from "../axes/ticks.js";
import {
  formatCompactCount, formatCountTick, formatDurationTick, formatMultiple, formatPercent, formatSeconds, formatShare,
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
const SUMMARY_INSET = 6; // pixels between the chart's lower right corner and the note comparing the medians
// A median's label: in the chart's ink, ringed in the card's colour so that a line it crosses does not cut its text.
const MEDIAN_LABEL_STYLE = Object.freeze({
  fill: "currentColor", stroke: "var(--color-surface)", strokeWidth: 3, paintOrder: "stroke",
});

// Each figure's x axis, from the pipeline's floor to the paper's end, its ticks (at most six) and, where they differ, its
// ticks on a narrow chart, how they are written, its title where its ticks carry no unit, how a value is written in a
// median's label and the tooltip, what the CDF counts, and the word the legend compares the medians by.
const TURN_DURATION_AXIS = Object.freeze({
  floor: MIN_DURATION_DRAWN_S,
  end: 86400, // a day
  ticks: Object.freeze([1, 60, 3600, 86400]),
  tickFormat: formatDurationTick,
  xLabel: null,
  valueFormat: formatSeconds,
  noun: "turns",
  comparative: "longer",
});
const SESSION_DURATION_AXIS = Object.freeze({
  floor: MIN_DURATION_DRAWN_S,
  end: 604800, // a week
  ticks: Object.freeze([1, 60, 3600, 86400, 604800]),
  narrowTicks: Object.freeze([1, 60, 3600, 86400]), // on a phone "1 d" and "7 d" would touch
  tickFormat: formatDurationTick,
  xLabel: null,
  valueFormat: formatSeconds,
  noun: "sessions",
  comparative: "longer",
});
const INPUT_AXIS = Object.freeze({
  floor: MIN_INPUT_DRAWN,
  end: 1e6,
  ticks: Object.freeze([1e3, 1e4, 1e5, 1e6]),
  tickFormat: formatCountTick,
  xLabel: "Input tokens",
  valueFormat: formatCompactCount,
  noun: "requests",
  comparative: "more",
});
const PROMPT_AXIS = Object.freeze({
  floor: MIN_PROMPT_DRAWN,
  end: 1e5,
  ticks: Object.freeze([1, 10, 100, 1e3, 1e4, 1e5]),
  narrowTicks: Object.freeze([1, 100, 1e4]), // on a phone six labels would touch
  tickFormat: formatCountTick,
  xLabel: "Tokens",
  valueFormat: formatCompactCount,
  noun: "prompts",
  comparative: "longer",
});

/** The turn duration figure entry, whose fields CONTRIBUTING.md defines. */
export const TURN_DURATION_BY_SCOPE = Object.freeze({
  name: "turn_duration_by_scope",
  title: "Turn duration",
  insight: "Benchmarks keep agents working longer without human interruption.",
  definition: "Each line shows the percentage of turns that finish within the time shown, for human sessions and SWE-Bench. A turn starts with a user prompt and ends with the agent’s final response. Dots mark the medians.",
  caption: "The median SWE-Bench turn lasts 188 seconds, compared with 61 seconds for human-driven turns. Benchmark agents work continuously on a predefined task.",
  drawsLines: true,
  query: "figures/turn_duration_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven turns", "SWE-Bench": "benchmark turns" }),
  legend: scopeLegend,
  draw: (rows, body, colours) => drawScopeCdf(rows, body, colours, TURN_DURATION_AXIS),
});

/** The session duration figure entry. */
export const SESSION_DURATION_BY_SCOPE = Object.freeze({
  name: "session_duration_by_scope",
  title: "Session duration",
  insight: "Real users keep coming back, making sessions much longer than benchmarks.",
  definition: "Each line shows the percentage of main sessions that finish within the time shown, for human sessions and SWE-Bench. Duration is measured from the first request’s start to the last request’s end, including waits between turns. Dots mark the medians.",
  caption: "Human-driven sessions last a median of 30 minutes, compared with 3.2 minutes for SWE-Bench. Multiple turns and idle periods extend production sessions well beyond individual tasks.",
  drawsLines: true,
  query: "figures/session_duration_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven sessions", "SWE-Bench": "benchmark sessions" }),
  legend: scopeLegend,
  draw: (rows, body, colours) => drawScopeCdf(rows, body, colours, SESSION_DURATION_AXIS),
});

/** The input per request figure entry. */
export const INPUT_PER_REQUEST_BY_SCOPE = Object.freeze({
  name: "input_per_request_by_scope",
  title: "Input per request",
  insight: "Benchmarks underestimate how large real agent contexts become.",
  definition: "Each line shows the percentage of main-session requests with this many input tokens or fewer, for human sessions and SWE-Bench. Only requests with reported input counts are included. Dots mark the medians.",
  caption: "Human-driven requests carry a median of 129K input tokens, compared with just 25K in SWE-Bench. Repeated user turns accumulate much larger histories and increase cache pressure.",
  drawsLines: true,
  isWide: true,
  query: "figures/input_per_request_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven requests", "SWE-Bench": "benchmark requests" }),
  legend: scopeLegend,
  draw: (rows, body, colours) => drawScopeCdf(rows, body, colours, INPUT_AXIS),
});

/** The user prompt figure entry. */
export const USER_PROMPT_TOKENS_BY_SCOPE = Object.freeze({
  name: "user_prompt_tokens_by_scope",
  title: "User prompt size",
  insight: "Real users give short instructions, unlike the detailed tasks in benchmarks.",
  definition: "Each line shows the percentage of user prompts with this many tokens or fewer, for human sessions and SWE-Bench. Prompt size is the increase in user tokens since the previous request; for the first request, it is all user tokens. Dots mark the medians.",
  caption: "SWE-Bench prompts have a median size of 1.4K tokens and little variation, while human-written prompts are typically shorter, with occasional large inputs such as code and error logs.",
  drawsLines: true,
  query: "figures/user_prompt_tokens_by_scope",
  binColumn: "series",
  seriesColumn: "series",
  seriesNouns: Object.freeze({ Agentic: "human-driven prompts", "SWE-Bench": "benchmark prompts" }),
  legend: scopeLegend,
  draw: (rows, body, colours) => drawScopeCdf(rows, body, colours, PROMPT_AXIS),
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
 * The chart's note comparing the medians it labels: the scope whose median is the larger, the ratio and
 * `comparative`, "benchmark 3.1× longer"; "" unless the rows hold both scopes and a ratio.
 */
export function medianSummary(rows, comparative) {
  const ratio = medianRatioText(rows);
  if (ratio === null) {
    return "";
  }
  const larger = scopeMedians(rows, 0).at(-1).series;
  return `${SCOPE_LABELS[larger].toLowerCase()} ${ratio} ${comparative}`;
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
  const chart = Plot.plot({
    ...frame,
    x: { type: "log", domain: [axis.floor, axis.end], inset: X_INSET },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, series.map((one) => one.name)),
    marks: [
      Plot.gridX(ticks, GRID_STYLE),
      Plot.gridY(GRID_STYLE),
      axisWithTicks(Plot.axisX, ticks, { ...AXIS_STYLE, tickFormat: axis.tickFormat, label: axis.xLabel }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: `Share of ${axis.noun}` }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH, clip: true }),
      ...medianMarks(Plot, rows, axis),
      summaryMark(Plot, medianSummary(rows, axis.comparative)),
      Plot.tip(points, Plot.pointerX({ ...TIP_STYLE, x: "x", y: "share", title: (point) => tipText(point, axis) })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The marks of the medians: a dot on each, the smaller's value above it to the left and the larger's below it to the
 * right, as the paper places them; with both scopes, the dotted line between them, whose ratio the chart's note gives.
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

/**
 * The note comparing the medians, `text`, written in the chart's lower right corner, which a CDF leaves empty: its
 * lines are high on the right. No note where `text` is "".
 */
function summaryMark(Plot, text) {
  const notes = text === "" ? [] : [text];
  return Plot.text(notes, {
    ...LINE_LABEL_STYLE, text: (note) => note, frameAnchor: "bottom-right", textAnchor: "end",
    dx: -SUMMARY_INSET, dy: -SUMMARY_INSET,
  });
}

function tipText(point, axis) {
  return `${point.label}\n${axis.valueFormat(point.x)}\n${formatShare(point.share)} of ${axis.noun}`;
}
