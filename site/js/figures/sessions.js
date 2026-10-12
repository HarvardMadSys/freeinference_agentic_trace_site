/**
 * The Sessions section of the Explore page's figures: how many requests and steps a session holds, how long its turns
 * and the session last, how many subagents it spawns, and how long its user prompts are, human-driven against
 * benchmark, drawn in `comparison/scope_cdfs.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import { drawCdf } from "../shared/charts.js";
import { atMost } from "../axes/ticks.js";
import { assignColours } from "../theme/colours.js";
import { formatCompactCount, formatCount, formatDurationTick, formatSeconds, formatWholeCount } from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";
import { USER_PROMPT_TOKENS_BY_SCOPE } from "../comparison/scope_cdfs.js";

// The series of the requests-per-session CDF, by their name in the query, with the name each is drawn under.
const SESSION_COUNT_SERIES = Object.freeze({ requests: "Requests", user_steps: "User steps", tool_steps: "Tool steps" });

// The series of the duration CDF, by their name in the query, with the name each is drawn under.
const DURATION_SERIES = Object.freeze({ turn: "Turn", session: "Session" });

const MIN_COUNT_DRAWN = 1; // a count below one (a session with no tool step) is drawn at one, on the log axis
const MIN_SECONDS_DRAWN = 0.1; // a duration below a tenth of a second is drawn at it, on the log axis
const DURATION_TICKS_S = Object.freeze([1, 60, 3600, 86400]); // a second, a minute, an hour and a day

// The subagents axis's ticks: a 1, 3, 10, 30 series is evenly spaced on a log axis, where 1, 2, 3, 10, 20, 30 is not.
const SUBAGENT_TICKS = Object.freeze([1, 3, 10, 30]);

/** The figures of the Sessions section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "requests_per_session_cdf",
    title: "Requests and steps per session",
    definition: "CDF over top-level sessions of their requests, user steps and tool steps; a session with no tool step is drawn at one.",
    caption: "Requests, user steps and tool steps of each top-level session.",
    drawsLines: true,
    query: "figures/requests_per_session_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesOverSameRows: true,
    legend: requestsPerSessionLegend,
    draw: drawRequestsPerSession,
  }),
  Object.freeze({
    name: "duration_cdf",
    title: "Turn and session duration",
    definition: "CDF of each turn's duration (a user step and the tool steps after it, first start to last end) and of each session's, in seconds.",
    caption: "Duration of each turn and of each top-level session.",
    drawsLines: true,
    query: "figures/duration_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesNouns: Object.freeze({ turn: "turns", session: "sessions" }),
    legend: durationLegend,
    draw: drawDurations,
  }),
  Object.freeze({
    name: "subagents_per_session",
    title: "Subagents per session",
    definition: "Subagent sessions each top-level session spawned, at any depth, on a log scale, where a session that spawned none is counted in the rows and the percentiles but not drawn.",
    caption: "Subagent sessions each top-level session spawned, at any depth.",
    query: "explore/subagents_per_session_bins",
    statsQuery: "explore/subagents_per_session_stats",
    countLabel: "Sessions",
    format: formatWholeCount,
    logScale: true,
    ticks: subagentTicks,
  }),
  USER_PROMPT_TOKENS_BY_SCOPE,
]);

/** The subagents axis's ticks within `[low, high]`, the range its bins span, every other one past `maxTicks`. */
export function subagentTicks([low, high], maxTicks) {
  return atMost(SUBAGENT_TICKS.filter((tick) => tick >= low && tick <= high), maxTicks);
}

/** The requests-per-session CDF's legend: requests, user steps and tool steps, in that order. */
function requestsPerSessionLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(Object.keys(SESSION_COUNT_SERIES)), SESSION_COUNT_SERIES);
}

/** The duration CDF's legend: turns, then sessions. */
function durationLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(Object.keys(DURATION_SERIES)), DURATION_SERIES);
}

/** Draw the CDFs of requests, user steps and tool steps per session, on a log axis. */
async function drawRequestsPerSession(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(SESSION_COUNT_SERIES), { labels: SESSION_COUNT_SERIES, floor: MIN_COUNT_DRAWN });
  await drawCdf(body, series, {
    xLabel: "Count", yLabel: "Share of sessions", logX: true, format: formatCount, xTickFormat: formatCompactCount,
    colours: colours.series,
  });
}

/** Draw the CDFs of turn and session durations, in seconds on a log axis. */
async function drawDurations(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(DURATION_SERIES), { labels: DURATION_SERIES, floor: MIN_SECONDS_DRAWN });
  await drawCdf(body, series, {
    logX: true, xTicks: DURATION_TICKS_S, xTickFormat: formatDurationTick, format: formatSeconds, colours: colours.series,
  });
}
