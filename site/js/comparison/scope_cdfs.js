/**
 * The Human-driven-against-benchmark CDFs of turn duration, session duration, input per request and user prompt tokens:
 * each a CDF per scope, human-driven and benchmark, drawn by the CDF kind (`charts/cdf.js`), each median marked with
 * its value and, as the paper draws them, a dotted line between the two medians and a note in the chart's lower right
 * corner saying which scope's median is the larger and by how much: the callout `medianComparison`. The first three
 * are listed in `comparison.js`; the user prompt size in the Session-structure section (`figures/sessions.js`).
 *
 * Every row of their queries is one CDF point of one scope: `series` (the scope, by the pipeline's name of it), `x` and
 * `share`; the same on every row of a scope, `rows` (what the scope's CDF is over) and `median`; and the same on every
 * row, `median_ratio`. A scope with too few rows is hidden whole, and a hidden scope's rows are left out before a chart
 * is drawn.
 */

import { AXIS_STYLE, LINE_LABEL_STYLE } from "../shared/charts.js";
import { drawCdf, MEDIAN_SHARE } from "../charts/cdf.js";
import {
  formatCompactCount, formatCountTick, formatDurationTick, formatMultiple, formatSeconds,
} from "../shared/format.js";
import { SCOPE_LABELS, scopeLegend, SCOPES } from "./scopes.js";

const MIN_DURATION_DRAWN_S = 1; // the pipeline's comparison.MIN_DURATION_DRAWN_S: a shorter turn or session is drawn at it
const MIN_INPUT_DRAWN = 1000; // comparison.MIN_INPUT_DRAWN: the input axis starts at 1k
const MIN_PROMPT_DRAWN = 1; // comparison.MIN_PROMPT_DRAWN: the user prompt axis starts at one token
const ONE_DAY_S = 86400; // the turn duration axis ends at a day, as the paper's does
const ONE_WEEK_S = 604800; // the session duration axis ends at a week, as the paper's does

const RATIO_DECIMALS = 1; // the ratio of the medians as the paper writes it: 3.1×
const MEDIAN_LINK_DASH = "1 3"; // the dotted line between the medians
const SUMMARY_INSET = 6; // pixels between the chart's lower right corner and the note comparing the medians

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
  draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
    labels: SCOPE_LABELS,
    floor: MIN_DURATION_DRAWN_S,
    logScale: true,
    xDomain: [MIN_DURATION_DRAWN_S, ONE_DAY_S],
    xTicks: [1, 60, 3600, ONE_DAY_S],
    xTickFormat: formatDurationTick,
    xLabel: null,
    yLabel: "Share of turns",
    valueFormat: formatSeconds,
    medianColumn: "median",
    shareNoun: "turns",
    callout: (Plot, drawn, medians) => medianComparison(Plot, drawn, medians, "longer"),
  }, hidden),
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
  draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
    labels: SCOPE_LABELS,
    floor: MIN_DURATION_DRAWN_S,
    logScale: true,
    xDomain: [MIN_DURATION_DRAWN_S, ONE_WEEK_S],
    xTicks: [1, 60, 3600, ONE_DAY_S, ONE_WEEK_S],
    narrowXTicks: [1, 60, 3600, ONE_DAY_S], // on a phone "1 d" and "7 d" would touch
    xTickFormat: formatDurationTick,
    xLabel: null,
    yLabel: "Share of sessions",
    valueFormat: formatSeconds,
    medianColumn: "median",
    shareNoun: "sessions",
    callout: (Plot, drawn, medians) => medianComparison(Plot, drawn, medians, "longer"),
  }, hidden),
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
  draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
    labels: SCOPE_LABELS,
    floor: MIN_INPUT_DRAWN,
    logScale: true,
    xDomain: [MIN_INPUT_DRAWN, 1e6],
    xTicks: [1e3, 1e4, 1e5, 1e6],
    xTickFormat: formatCountTick,
    xLabel: "Input tokens",
    yLabel: "Share of requests",
    valueFormat: formatCompactCount,
    medianColumn: "median",
    shareNoun: "requests",
    callout: (Plot, drawn, medians) => medianComparison(Plot, drawn, medians, "more"),
  }, hidden),
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
  draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
    labels: SCOPE_LABELS,
    floor: MIN_PROMPT_DRAWN,
    logScale: true,
    xDomain: [MIN_PROMPT_DRAWN, 1e5],
    xTicks: [1, 10, 100, 1e3, 1e4, 1e5],
    narrowXTicks: [1, 100, 1e4], // on a phone six labels would touch
    xTickFormat: formatCountTick,
    xLabel: "Tokens",
    yLabel: "Share of prompts",
    valueFormat: formatCompactCount,
    medianColumn: "median",
    shareNoun: "prompts",
    callout: (Plot, drawn, medians) => medianComparison(Plot, drawn, medians, "longer"),
  }, hidden),
});

/**
 * The chart's note comparing the medians it labels (`seriesMedians`, smallest first): the scope whose median is the
 * larger, the ratio and `comparative`, "benchmark 3.1× longer"; "" unless the rows hold both scopes and a ratio.
 */
export function medianSummary(rows, medians, comparative) {
  const ratio = medianRatioText(rows);
  if (ratio === null) {
    return "";
  }
  const larger = medians.at(-1).series;
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
 * A scope CDF's callout, the marks comparing the medians the CDF marked (`seriesMedians`, smallest first) from the
 * rows drawn: with both scopes, a dotted line between the medians where they are drawn, and the note in the lower
 * right corner, "benchmark 3.1× longer", `comparative` saying how the larger compares.
 */
export function medianComparison(Plot, rows, medians, comparative) {
  const marks = [];
  if (medianRatioText(rows) !== null) {
    marks.push(Plot.ruleY([MEDIAN_SHARE], {
      ...AXIS_STYLE, x1: medians[0].x, x2: medians[1].x, strokeDasharray: MEDIAN_LINK_DASH,
    }));
  }
  marks.push(summaryMark(Plot, medianSummary(rows, medians, comparative)));
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
