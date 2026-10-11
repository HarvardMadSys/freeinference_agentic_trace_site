/**
 * The Sessions section of the Explore page's figures: how long sessions are, and how their tokens are spent.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import {
  assignColours,
  AXIS_STYLE,
  chartFrame,
  colourScale,
  distinct,
  drawBars,
  drawCdf,
  GRID_STYLE,
  LINE_WIDTH,
  SERIES_SLOTS,
  TIP_STYLE,
  TOKEN_PART_COLOURS,
} from "../shared/charts.js";
import { formatCount, formatSeconds, formatShare, formatTokens, monthAndDay } from "../shared/format.js";
import { cdfSeries, seriesLegend, sparseTickFormat } from "./figure_rows.js";

// The series of the requests-per-session CDF, by their name in the query, with the name each is drawn under.
const SESSION_COUNT_SERIES = Object.freeze({ requests: "Requests", user_steps: "User steps", tool_steps: "Tool steps" });

// The series of the duration CDF, by their name in the query, with the name each is drawn under.
const DURATION_SERIES = Object.freeze({ turn: "Turn", session: "Session" });

// The series of the tokens-per-request CDF, by their name in the query, with the name each is drawn under.
const TOKEN_SERIES = Object.freeze({ input: "Input", uncached: "Uncached input", output: "Output" });

// A request's token parts, bottom up in a stacked bar, each drawn in its token colour.
const TOKEN_PARTS = Object.freeze(["cached", "uncached", "output"]);

// The median column of each token part in the token growth query.
const GROWTH_COLUMNS = Object.freeze({
  cached: "median_cached_tokens",
  uncached: "median_uncached_tokens",
  output: "median_output_tokens",
});

// The parts of a request's input, bottom up in a stacked bar; each takes its series colour in this order.
const ROLES = Object.freeze(["system", "user", "assistant", "tool", "tool_definitions"]);

const MIN_COUNT_DRAWN = 1; // a count below one (a session with no tool step) is drawn at one, on the log axis
const MIN_SECONDS_DRAWN = 0.1; // a duration below a tenth of a second is drawn at it, on the log axis
const MIN_TOKENS_DRAWN = 1; // a token count below one (a request with nothing uncached) is drawn at one, on the log axis
const MARKER_RADIUS = 3; // pixels; the small markers on the token growth lines
const MAX_BAR_LABELS = 6; // a bar chart's axis labels at most this many bars, so the labels fit a phone's width

/** The figures of the Sessions section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "requests_per_session_cdf",
    title: "Requests and steps per session",
    definition: "CDF over top-level sessions of their requests, user steps and tool steps; a session with no tool step is drawn at one.",
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
    query: "figures/tokens_per_request_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesOverSameRows: true,
    legend: tokensPerRequestLegend,
    draw: drawTokensPerRequest,
  }),
  Object.freeze({
    name: "token_split_by_week",
    title: "Token split by week",
    definition: "Per selected week, the share of cached input, uncached input and output in the tokens of requests whose provider reports cache reads: plain token shares, where the paper weights them by price and ranks sessions.",
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
    query: "figures/token_growth_by_messages",
    binColumn: "bin_start",
    legend: tokenGrowthLegend,
    draw: drawTokenGrowth,
  }),
  Object.freeze({
    name: "context_share_by_role",
    title: "Context share by role",
    definition: "Share of the input held by system, user, assistant and tool messages and by tool definitions, pooled per power-of-two bin of input tokens, where the paper takes each request's share per bin of messages and its main figure leaves tool definitions out.",
    query: "figures/context_share_by_role",
    binColumn: "bin_start",
    seriesColumn: "role",
    legend: contextShareLegend,
    draw: drawContextShare,
  }),
  Object.freeze({
    name: "ttft_cdf_by_model",
    title: "Time to first token by model",
    definition: "CDF of the time to first token of the five models with most requests in the selection, over requests whose TTFT is trusted (positive and under 95% of the latency), where the paper draws two fixed models, each with its decode and queueing time.",
    query: "figures/ttft_cdf_by_model",
    binColumn: "series",
    seriesColumn: "series",
    legend: ttftLegend,
    draw: drawTtftByModel,
  }),
]);

/** The requests-per-session CDF's legend: requests, user steps and tool steps, in that order. */
function requestsPerSessionLegend(rows) {
  return seriesLegend(rows, "series", assignColours(Object.keys(SESSION_COUNT_SERIES)), SESSION_COUNT_SERIES);
}

/** The duration CDF's legend: turns, then sessions. */
function durationLegend(rows) {
  return seriesLegend(rows, "series", assignColours(Object.keys(DURATION_SERIES)), DURATION_SERIES);
}

/** The tokens-per-request CDF's legend: input, uncached input and output, the last two in their token colours. */
function tokensPerRequestLegend(rows) {
  // Input is the whole prompt, not a part of it, so it takes the fourth series colour, the first no token part uses.
  const colours = new Map([
    ["input", SERIES_SLOTS[3]],
    ["uncached", TOKEN_PART_COLOURS.uncached],
    ["output", TOKEN_PART_COLOURS.output],
  ]);
  return seriesLegend(rows, "series", colours, TOKEN_SERIES);
}

/** The token split's legend: the token parts, in their colours. */
function tokenSplitLegend(rows) {
  return seriesLegend(rows, "part", tokenPartColours());
}

/** The token growth's legend: the token parts, in their colours; each is a column of every row. */
function tokenGrowthLegend() {
  return { series: TOKEN_PARTS.map((part) => ({ name: part, label: part })), colours: tokenPartColours() };
}

/** The context share's legend: the roles, in their order. */
function contextShareLegend(rows) {
  return seriesLegend(rows, "role", assignColours(ROLES));
}

/** The TTFT CDF's legend: its models, in the model order and colours every chart shares. */
function ttftLegend(rows, colours) {
  return seriesLegend(rows, "series", colours.models);
}

/** Draw the CDFs of requests, user steps and tool steps per session, on a log axis. */
async function drawRequestsPerSession(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(SESSION_COUNT_SERIES), { labels: SESSION_COUNT_SERIES, floor: MIN_COUNT_DRAWN });
  await drawCdf(body, series, { xLabel: "Per session", logX: true, format: formatCount, colours: colours.series });
}

/** Draw the CDFs of turn and session durations, in seconds on a log axis. */
async function drawDurations(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(DURATION_SERIES), { labels: DURATION_SERIES, floor: MIN_SECONDS_DRAWN });
  await drawCdf(body, series, { xLabel: "Seconds", logX: true, format: formatSeconds, colours: colours.series });
}

/** Draw the CDFs of input, uncached input and output tokens per request, on a log axis. */
async function drawTokensPerRequest(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TOKEN_SERIES), { labels: TOKEN_SERIES, floor: MIN_TOKENS_DRAWN });
  await drawCdf(body, series, { xLabel: "Tokens per request", logX: true, format: formatTokens, colours: colours.series });
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
    xLabel: "Week",
    yLabel: "Share of tokens",
    format: formatShare,
    xTickFormat: sparseTickFormat(distinct(rows.map((row) => row.week)), monthAndDay, MAX_BAR_LABELS),
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
    xLabel: "Input tokens, from",
    yLabel: "Share of input",
    format: formatShare,
    xTickFormat: sparseTickFormat(distinct(rows.map((row) => row.bin_start)), formatTokens, MAX_BAR_LABELS),
  });
}

/** Draw the TTFT CDFs of the selection's largest models, in seconds on a log axis, each model in its colour on every chart. */
async function drawTtftByModel(rows, body, colours) {
  const series = cdfSeries(rows, [...colours.series.keys()]);
  await drawCdf(body, series, { xLabel: "Seconds to first token", logX: true, format: formatSeconds, colours: colours.series });
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
  const marks = [
    Plot.gridX(GRID_STYLE),
    Plot.gridY(GRID_STYLE),
    Plot.axisX({ ...AXIS_STYLE, label: "Messages in the request" }),
    Plot.axisY({ ...AXIS_STYLE, label: "Median tokens" }),
    Plot.line(points, { x: "messages", y: "tokens", stroke: "part", strokeWidth: LINE_WIDTH }),
    Plot.dot(points, { x: "messages", y: "tokens", fill: "part", r: MARKER_RADIUS }),
    Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "messages", y: "tokens", title: growthTipText })),
  ];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log" },
    y: { type: "log" },
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
  return `${point.part}\n${messages}\nmedian ${formatTokens(point.median)} tokens\n${formatCount(point.rows)} requests`;
}

/** The token part colours as a map from part to colour, as the chart helpers take them. */
function tokenPartColours() {
  return new Map(Object.entries(TOKEN_PART_COLOURS));
}
