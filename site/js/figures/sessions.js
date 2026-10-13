/**
 * The Session-structure section of the Explore page's figures: how many requests and steps a session holds, how long
 * its turns and the session last, how many subagents it spawns, and how long its user prompts are, human-driven
 * against benchmark, drawn in `comparison/scope_cdfs.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import { drawCdf } from "../shared/cdf.js";
import { atMost } from "../axes/ticks.js";
import { assignColours } from "../theme/colours.js";
import { formatCount, formatCountTick, formatDurationTick, formatSeconds, formatWholeCount } from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";
import { USER_PROMPT_TOKENS_BY_SCOPE } from "../comparison/scope_cdfs.js";

// The series of the requests-per-session CDF, by their name in the query, with the name each is drawn under.
const SESSION_COUNT_SERIES = Object.freeze({ requests: "Requests", user_steps: "User steps", tool_steps: "Tool steps" });

// The series of the duration CDF, by their name in the query, with the name each is drawn under.
const DURATION_SERIES = Object.freeze({ turn: "Turn", session: "Session" });

// Each CDF's series in the series colours, in the order above.
const SESSION_COUNT_COLOURS = assignColours(Object.keys(SESSION_COUNT_SERIES));
const DURATION_COLOURS = assignColours(Object.keys(DURATION_SERIES));

const MIN_COUNT_DRAWN = 1; // a count below one (a session with no tool step) is drawn at one, on the log axis
const MIN_SECONDS_DRAWN = 0.1; // a duration below a tenth of a second is drawn at it, on the log axis
const DURATION_TICKS_S = Object.freeze([1, 60, 3600, 86400]); // a second, a minute, an hour and a day

// The factor from one subagent bin's start to the next: the bins query's bins double (base 2), so the axis ticks at
// their edges, 1, 2, 4, 8, and each bar starts and ends at a labelled tick.
const SUBAGENT_BIN_FACTOR = 2;

/** The Session-structure topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Sessions have a few user prompts, dozens of model requests, and long waits between prompts.";

/** The figures of the Session-structure section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "requests_per_session_cdf",
    title: "Requests and steps per session",
    insight: "A handful of user prompts can trigger hundreds of LLM and tool interactions.",
    definition: "Each line shows the percentage of main sessions with this many requests or fewer. The lines count all model requests, requests after user prompts, and requests after tool results. Sessions with no tool requests are shown at one on the log scale.",
    caption: "A median session contains just 4 user steps, compared with 42 LLM requests and 36 tool steps. Most activity happens within the autonomous LLM–tool loop.",
    drawsLines: true,
    query: "figures/requests_per_session_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesOverSameRows: true,
    legend: (rows, colours, seriesColumn) => seriesLegend(rows, seriesColumn, SESSION_COUNT_COLOURS, SESSION_COUNT_SERIES),
    draw: drawRequestsPerSession,
  }),
  Object.freeze({
    name: "duration_cdf",
    title: "Turn and session duration",
    insight: "Agents work in short bursts, but sessions stay alive while humans think.",
    definition: "Each line shows the percentage of turns or main sessions that finish within the time shown. A turn starts with a user prompt and ends with the agent’s final response. A session includes all turns and the waits between them.",
    caption: "The median turn lasts about one minute, while the median session spans 30 minutes. The difference largely comes from idle time between user turns.",
    drawsLines: true,
    query: "figures/duration_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesNouns: Object.freeze({ turn: "turns", session: "sessions" }),
    legend: (rows, colours, seriesColumn) => seriesLegend(rows, seriesColumn, DURATION_COLOURS, DURATION_SERIES),
    draw: drawDurations,
  }),
  Object.freeze({
    name: "subagents_per_session",
    title: "Subagents per session",
    insight: "Multi-agent coding is still mostly single-agent coding.",
    definition: "The number of subagents started by each main session, including subagents started by other subagents. Sessions with no subagents count toward the summary statistics but are not shown on the log scale.",
    caption: "Nearly 90% of sessions never invoke subagents. Even when used, most subagent calls spawn just one child rather than multiple agents in parallel. Sessions with zero subagents are excluded from the bars.",
    query: "explore/subagents_per_session_bins",
    statsQuery: "explore/subagents_per_session_stats",
    countLabel: "Sessions",
    xLabel: "Subagents",
    format: formatWholeCount,
    logScale: true,
    showsMaximum: true,
    ticks: subagentTicks,
  }),
  USER_PROMPT_TOKENS_BY_SCOPE,
]);

/**
 * The subagents axis's ticks within `[low, high]`, the range its bins span: the bins' edges, the powers of two from one,
 * every other one past `maxTicks`.
 */
export function subagentTicks([low, high], maxTicks) {
  const edges = [];
  for (let edge = 1; edge <= high; edge *= SUBAGENT_BIN_FACTOR) {
    if (edge >= low) {
      edges.push(edge);
    }
  }
  return atMost(edges, maxTicks);
}

/** Draw the CDFs of requests, user steps and tool steps per session, on a log axis. */
async function drawRequestsPerSession(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(SESSION_COUNT_SERIES), { labels: SESSION_COUNT_SERIES, floor: MIN_COUNT_DRAWN });
  await drawCdf(body, series, {
    xLabel: "Requests or steps", yLabel: "Share of sessions", logX: true, format: formatCount, xTickFormat: formatCountTick,
    colours: colours.series,
  });
}

/** Draw the CDFs of turn and session durations, in seconds on a log axis. */
async function drawDurations(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(DURATION_SERIES), { labels: DURATION_SERIES, floor: MIN_SECONDS_DRAWN });
  await drawCdf(body, series, {
    yLabel: "Share of turns or sessions", logX: true, xTicks: DURATION_TICKS_S, xTickFormat: formatDurationTick, format: formatSeconds, colours: colours.series,
  });
}
