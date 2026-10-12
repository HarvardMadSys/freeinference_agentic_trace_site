/**
 * The Sessions section of the Explore page's figures: how long sessions are, and how their tokens are spent.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 *
 * Two modules hold some of the section's entries, listed here in the section's order: `sessions_ranked.js` the
 * figures that rank sessions by a share, and `sessions_latency.js` the per-model CDFs of TTFT and decode time and the
 * speed-up if one part of a session's machine time ran twice as fast.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, distinct, drawBars, drawCdf, GRID_STYLE, LINE_WIDTH, TIP_STYLE,
} from "../shared/charts.js";
import { decadeDomain, decadeTicks, sparseTickFormat, weekTickFormat } from "../axes/ticks.js";
import { assignColours, SERIES_SLOTS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import {
  formatBinaryThousands, formatCompactCount, formatCount, formatDurationTick, formatPercent, formatSeconds, formatShare,
  formatTokens,
} from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";
import { DECODE_CDF_BY_MODEL, SPEEDUP_IF_TWICE_AS_FAST, TTFT_CDF_BY_MODEL } from "./sessions_latency.js";
import { COST_SHARE_BY_SESSION, SESSION_TIME_BY_PART } from "./sessions_ranked.js";

// The series of the requests-per-session CDF, by their name in the query, with the name each is drawn under.
const SESSION_COUNT_SERIES = Object.freeze({ requests: "Requests", user_steps: "User steps", tool_steps: "Tool steps" });

// The series of the duration CDF, by their name in the query, with the name each is drawn under.
const DURATION_SERIES = Object.freeze({ turn: "Turn", session: "Session" });

// The series of the tokens-per-request CDF, by their name in the query, with the name each is drawn under.
const TOKEN_SERIES = Object.freeze({ input: "Input", uncached: "Uncached input", output: "Output" });

// A request's token parts, bottom up in a stacked bar, each drawn in its token colour.
const TOKEN_PARTS = Object.freeze(["cached", "uncached", "output"]);

// The label each token part has in a legend and a tooltip.
const TOKEN_PART_LABELS = Object.freeze({ cached: "Cached input", uncached: "Uncached input", output: "Output" });

// The median column of each token part in the token growth query.
const GROWTH_COLUMNS = Object.freeze({
  cached: "median_cached_tokens",
  uncached: "median_uncached_tokens",
  output: "median_output_tokens",
});

// The parts of a request's input, bottom up in a stacked bar; each takes its series colour in this order.
const ROLES = Object.freeze(["system", "user", "assistant", "tool", "tool_definitions"]);

// The label each part of a request's input has in the legend.
const ROLE_LABELS = Object.freeze({
  system: "System",
  user: "User",
  assistant: "Assistant",
  tool: "Tool results",
  tool_definitions: "Tool definitions",
});

const MIN_COUNT_DRAWN = 1; // a count below one (a session with no tool step) is drawn at one, on the log axis
const MIN_SECONDS_DRAWN = 0.1; // a duration below a tenth of a second is drawn at it, on the log axis
const MIN_TOKENS_DRAWN = 1; // a token count below one (a request with nothing uncached) is drawn at one, on the log axis
const MARKER_RADIUS = 3; // pixels; the small markers on the token growth lines
const MAX_BAR_LABELS = 5; // a bar chart's axis labels at most this many bars, so the labels fit a phone's width
const DURATION_TICKS_S = Object.freeze([1, 60, 3600, 86400]); // a second, a minute, an hour and a day

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
    name: "tokens_per_request_cdf",
    title: "Tokens per request",
    definition: "CDF over requests of input tokens, uncached input tokens (where the provider reports cache reads) and output tokens (where there are more than one, as in the paper).",
    caption: "Input, uncached input and output tokens of each request.",
    drawsLines: true,
    query: "figures/tokens_per_request_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesOverSameRows: true,
    legend: tokensPerRequestLegend,
    draw: drawTokensPerRequest,
  }),
  COST_SHARE_BY_SESSION,
  Object.freeze({
    name: "token_split_by_week",
    title: "Token split by week",
    definition: "Per week, the share of cached input, uncached input and output in the tokens of requests whose provider reports cache reads: plain token shares, where the paper weights them by price and ranks sessions.",
    caption: "Share of cached input, uncached input and output tokens, each week.",
    query: "figures/token_split_by_week",
    binColumn: "week",
    seriesColumn: "part",
    legend: tokenSplitLegend,
    draw: drawTokenSplit,
  }),
  Object.freeze({
    name: "token_growth_by_messages",
    title: "Token growth with the context",
    definition: "Median cached, uncached and output tokens per request, by the number of messages in the request, in fixed power-of-two bins where the paper fits its bins to the data.",
    caption: "Median cached, uncached and output tokens per request, by messages in the request.",
    drawsLines: true,
    query: "figures/token_growth_by_messages",
    binColumn: "bin_start",
    legend: tokenGrowthLegend,
    draw: drawTokenGrowth,
  }),
  Object.freeze({
    name: "context_share_by_role",
    title: "Context share by role",
    definition: "Share of the input held by system, user, assistant and tool messages and by tool definitions, pooled per power-of-two bin of input tokens (4k is 4,096), where the paper takes each request's share per bin of messages and its main figure leaves tool definitions out.",
    caption: "Share of the input held by each role, by input size.",
    query: "figures/context_share_by_role",
    binColumn: "bin_start",
    seriesColumn: "role",
    legend: contextShareLegend,
    draw: drawContextShare,
  }),
  TTFT_CDF_BY_MODEL,
  DECODE_CDF_BY_MODEL,
  SESSION_TIME_BY_PART,
  SPEEDUP_IF_TWICE_AS_FAST,
]);

/** The requests-per-session CDF's legend: requests, user steps and tool steps, in that order. */
function requestsPerSessionLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(Object.keys(SESSION_COUNT_SERIES)), SESSION_COUNT_SERIES);
}

/** The duration CDF's legend: turns, then sessions. */
function durationLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(Object.keys(DURATION_SERIES)), DURATION_SERIES);
}

/** The tokens-per-request CDF's legend: input, uncached input and output, the last two in their token colours. */
function tokensPerRequestLegend(rows, colours, seriesColumn) {
  // Input is the whole prompt, not a part of it, so it takes the fourth series colour, the first no token part uses.
  const tokenColours = new Map([
    ["input", SERIES_SLOTS[3]],
    ["uncached", TOKEN_PART_COLOURS.uncached],
    ["output", TOKEN_PART_COLOURS.output],
  ]);
  return seriesLegend(rows, seriesColumn, tokenColours, TOKEN_SERIES);
}

/** The token split's legend: the token parts, in their colours. */
function tokenSplitLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, tokenPartColours(), TOKEN_PART_LABELS);
}

/** The token growth's legend: the token parts, in their colours; each is a column of every row. */
function tokenGrowthLegend() {
  const series = TOKEN_PARTS.map((part) => ({ name: part, label: TOKEN_PART_LABELS[part] }));
  return { series, colours: tokenPartColours() };
}

/** The context share's legend: the roles, in their order. */
function contextShareLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(ROLES), ROLE_LABELS);
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

/** Draw the CDFs of input, uncached input and output tokens per request, on a log axis. */
async function drawTokensPerRequest(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TOKEN_SERIES), { labels: TOKEN_SERIES, floor: MIN_TOKENS_DRAWN });
  await drawCdf(body, series, { logX: true, format: formatTokens, xTickFormat: formatTokens, colours: colours.series });
}

/** Draw one stacked bar per week of its cached, uncached and output shares. */
async function drawTokenSplit(rows, body, colours) {
  await drawBars(body, rows, {
    x: "week",
    y: "share",
    fill: "part",
    order: TOKEN_PARTS,
    colours: colours.series,
    stacked: true,
    xLabel: null,
    yLabel: "Share of tokens",
    format: formatShare,
    yTickFormat: formatPercent,
    xTickFormat: weekTickFormat(distinct(rows.map((row) => row.week))),
  });
}

/** Draw one stacked bar per input-size bin of each role's share of the input. */
async function drawContextShare(rows, body, colours) {
  await drawBars(body, rows, {
    x: "bin_start",
    y: "share",
    fill: "role",
    order: ROLES,
    colours: colours.series,
    stacked: true,
    xLabel: "Input tokens",
    yLabel: "Share of input",
    format: formatShare,
    yTickFormat: formatPercent,
    xTickFormat: sparseTickFormat(distinct(rows.map((row) => row.bin_start)), formatBinaryThousands, MAX_BAR_LABELS),
  });
}

/**
 * Draw one line per token part of its median tokens against the messages in the request, both axes log, with markers;
 * the parts in `hidden` are left out.
 */
async function drawTokenGrowth(rows, body, colours, hidden) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const parts = TOKEN_PARTS.filter((part) => !hidden.has(part));
  const points = growthPoints(rows, parts);
  const xDomain = decadeDomain(points.map((point) => point.messages));
  const yDomain = decadeDomain(points.map((point) => point.tokens));
  const marks = [
    // Only the powers of ten are ruled and labelled: a log axis's own ticks would draw a mesh of minor lines.
    Plot.gridX(decadeTicks(xDomain), GRID_STYLE),
    Plot.gridY(decadeTicks(yDomain), GRID_STYLE),
    Plot.axisX(decadeTicks(xDomain), { ...AXIS_STYLE, label: "Messages in the request", text: formatCompactCount }),
    Plot.axisY(decadeTicks(yDomain), { ...AXIS_STYLE, label: "Median tokens", text: formatTokens }),
    Plot.line(points, { x: "messages", y: "tokens", stroke: "part", strokeWidth: LINE_WIDTH }),
    Plot.dot(points, { x: "messages", y: "tokens", fill: "part", r: MARKER_RADIUS }),
    Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "messages", y: "tokens", title: growthTipText })),
  ];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: xDomain },
    y: { type: "log", domain: yDomain },
    color: colourScale(colours.series, parts),
    marks,
  });
  body.replaceChildren(chart);
}

/** One point per bin and part of `parts` with a median: `{ part, messages, tokens, median, rows }`, each part's points in bin order. */
function growthPoints(rows, parts) {
  const points = [];
  for (const part of parts) {
    for (const row of rows) {
      const median = row[GROWTH_COLUMNS[part]];
      if (median !== null) {
        points.push({ part, messages: row.bin_start, tokens: Math.max(median, MIN_TOKENS_DRAWN), median, rows: row.rows });
      }
    }
  }
  return points;
}

function growthTipText(point) {
  const lastMessage = 2 * point.messages - 1; // a power-of-two bin runs to one below the next power of two
  const messages = `${formatCount(point.messages)}–${formatCount(lastMessage)} messages`;
  const median = `median ${formatTokens(point.median)} tokens`;
  return `${TOKEN_PART_LABELS[point.part]}\n${messages}\n${median}\n${formatCount(point.rows)} requests`;
}

/** The token part colours as a map from part to colour, as the chart helpers take them. */
function tokenPartColours() {
  return new Map(Object.entries(TOKEN_PART_COLOURS));
}
