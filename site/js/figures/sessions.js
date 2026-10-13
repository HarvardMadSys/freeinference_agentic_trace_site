/**
 * The Session-structure section of the Explore page's figures: how many requests and steps a session holds, how long
 * its turns and the session last, how many subagents it spawns, and how long its user prompts are, human-driven
 * against benchmark, a figure listed in `comparison/scope_cdfs.js` and drawn by the CDF kind.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines, drawn by one call to its chart kind
 * (`charts/`). A figure of more than one series colours each from its legend's colours, `colours.series`, so its chart
 * and its legend agree whichever series are hidden.
 */

import { cdfLegend, drawCdf } from "../charts/cdf.js";
import { drawHistogram } from "../charts/histogram.js";
import { atMost } from "../axes/ticks.js";
import { assignColours } from "../theme/colours.js";
import { formatCount, formatCountTick, formatDurationTick, formatSeconds, formatWholeCount } from "../shared/format.js";
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

// The subagents histogram's stats query: the median, 95th percentile, maximum and count its bins are summarised by.
const SUBAGENTS_STATS_QUERY = "explore/subagents_per_session_stats";

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
    legend: (rows) => cdfLegend(rows, SESSION_COUNT_COLOURS, { labels: SESSION_COUNT_SERIES }),
    draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
      labels: SESSION_COUNT_SERIES,
      floor: MIN_COUNT_DRAWN,
      logScale: true,
      xTickFormat: formatCountTick,
      xLabel: "Requests or steps",
      yLabel: "Share of sessions",
      valueFormat: formatCount,
    }, hidden),
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
    legend: (rows) => cdfLegend(rows, DURATION_COLOURS, { labels: DURATION_SERIES }),
    draw: (rows, body, colours, hidden) => drawCdf(rows, body, colours, {
      labels: DURATION_SERIES,
      floor: MIN_SECONDS_DRAWN,
      logScale: true,
      xTicks: DURATION_TICKS_S,
      xTickFormat: formatDurationTick,
      xLabel: null,
      yLabel: "Share of turns or sessions",
      valueFormat: formatSeconds,
    }, hidden),
  }),
  Object.freeze({
    name: "subagents_per_session",
    title: "Subagents per session",
    insight: "Multi-agent coding is still mostly single-agent coding.",
    definition: "The number of subagents started by each main session, including subagents started by other subagents. Sessions with no subagents count toward the summary statistics but are not shown on the log scale.",
    caption: "Nearly 90% of sessions never invoke subagents. Even when used, most subagent calls spawn just one child rather than multiple agents in parallel. Sessions with zero subagents are excluded from the bars.",
    query: "explore/subagents_per_session_bins",
    statsQuery: SUBAGENTS_STATS_QUERY,
    draw: (rows, body, colours) => drawHistogram(rows, body, colours, {
      statsQuery: SUBAGENTS_STATS_QUERY,
      countLabel: "Sessions",
      xLabel: "Subagents",
      valueFormat: formatWholeCount,
      xTickFormat: formatWholeCount,
      logScale: true,
      logCounts: false,
      showsMaximum: true,
      ticks: subagentTicks,
    }),
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
