/**
 * The Tokens-and-cost section of the Explore page's figures: how many tokens a request holds, how they split between
 * cached input, uncached input and output, how they grow with the context, which roles fill the input, how much of a
 * request's input is cached, and how a session's cost splits, drawn in `sessions_ranked.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, distinct, drawBars, GRID_STYLE, LINE_WIDTH, TIP_STYLE,
} from "../shared/charts.js";
import { drawCdf } from "../shared/cdf.js";
import { axisWithTicks, decadeDomain, decadeTicks, sparseTickFormat, weekTickFormat } from "../axes/ticks.js";
import { assignColours, ROLE_COLOURS, SERIES_SLOTS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import {
  formatBinaryThousands, formatCount, formatCountTick, formatPercent, formatShare, formatTokens,
} from "../shared/format.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";
import { COST_SHARE_BY_SESSION } from "./sessions_ranked.js";

// The series of the tokens-per-request CDF, by their name in the query, with the name each is drawn under.
const TOKEN_SERIES = Object.freeze({
  input: "Input", uncached: TOKEN_PART_NAMES.uncached, output: TOKEN_PART_NAMES.output,
});

// A request's token parts, bottom up in a stacked bar, each drawn in its token colour.
const TOKEN_PARTS = Object.freeze(["cached", "uncached", "output"]);

// The median column of each token part in the token growth query.
const GROWTH_COLUMNS = Object.freeze({
  cached: "median_cached_tokens",
  uncached: "median_uncached_tokens",
  output: "median_output_tokens",
});

// The parts of a request's input, bottom up in a stacked bar; each takes its role's colour.
const ROLES = Object.freeze(["system", "user", "assistant", "tool", "tool_definitions"]);

// The label each part of a request's input has in the legend.
const ROLE_LABELS = Object.freeze({
  system: "System",
  user: "User",
  assistant: "Assistant",
  tool: "Tool results",
  tool_definitions: "Tool definitions",
});

const MIN_TOKENS_DRAWN = 1; // a token count below one (a request with nothing uncached) is drawn at one, on the log axis
const MARKER_RADIUS = 3; // pixels; the small markers on the token growth lines
const MAX_BAR_LABELS = 5; // a bar chart's axis labels at most this many bars, so the labels fit a phone's width

/** The Tokens-and-cost topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Requests reuse large, growing contexts while adding little, so cache reads dominate tokens and cost.";

/** The figures of the Tokens-and-cost section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "tokens_per_request_cdf",
    title: "Tokens per request",
    insight: "Each request adds little to a large context.",
    definition: "Share of requests with at most each number of input tokens, uncached input tokens (where the provider reports cache reads) and output tokens (where there are more than one).",
    caption: "Input, uncached input and output tokens of each request.",
    drawsLines: true,
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
    insight: "Cached input is almost all of the tokens, every week.",
    definition: "Per week, the share of cached input, uncached input and output in the tokens of requests whose provider reports cache reads, each token counted once whatever its price.",
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
    insight: "The cached prefix grows all session; new tokens stay small.",
    definition: "Median cached, uncached and output tokens per request, by the number of messages in the request, in fixed power-of-two bins of messages.",
    caption: "Median tokens per request, by messages in the request.",
    drawsLines: true,
    query: "figures/token_growth_by_messages",
    binColumn: "bin_start",
    legend: tokenGrowthLegend,
    draw: drawTokenGrowth,
  }),
  Object.freeze({
    name: "context_share_by_role",
    title: "Context share by role",
    insight: "Tool results fill mid-session contexts; assistant history fills the longest.",
    definition: "Share of the input held by system, user, assistant and tool messages and tool definitions, the tokens of every request pooled per power-of-two bin of input tokens (4k is 4,096).",
    caption: "Share of the input held by each role, by input size.",
    query: "figures/context_share_by_role",
    binColumn: "bin_start",
    seriesColumn: "role",
    legend: contextShareLegend,
    draw: drawContextShare,
  }),
  Object.freeze({
    name: "cached_fraction_per_request",
    title: "Cached share per request",
    insight: "Most requests reuse nearly all of their prefix.",
    definition: "Cached over input tokens of each top-level request whose provider reports cache reads, in bins of 5%, the requests of each bin counted on a log axis.",
    caption: "Cached over input tokens, where the provider reports cache reads.",
    query: "explore/cached_fraction_bins",
    statsQuery: "explore/cached_fraction_stats",
    countLabel: "Requests",
    format: formatShare,
    tickFormat: formatPercent,
    logScale: false,
    logCounts: true,
  }),
  COST_SHARE_BY_SESSION,
]);

/** The tokens-per-request CDF's legend: input, uncached input and output, the last two in their token colours. */
function tokensPerRequestLegend(rows, colours, seriesColumn) {
  // Input is the whole prompt, not a part of it, so it takes violet, the one slot neither a token part nor a part of a
  // session's time uses.
  const tokenColours = new Map([
    ["input", SERIES_SLOTS[6]],
    ["uncached", TOKEN_PART_COLOURS.uncached],
    ["output", TOKEN_PART_COLOURS.output],
  ]);
  return seriesLegend(rows, seriesColumn, tokenColours, TOKEN_SERIES);
}

/** The token split's legend: the token parts, in their colours. */
function tokenSplitLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, tokenPartColours(), TOKEN_PART_NAMES);
}

/** The token growth's legend: the token parts, in their colours; each is a column of every row. */
function tokenGrowthLegend() {
  const series = TOKEN_PARTS.map((part) => ({ name: part, label: TOKEN_PART_NAMES[part] }));
  return { series, colours: tokenPartColours() };
}

/** The context share's legend: the roles, in their order and colours. */
function contextShareLegend(rows, colours, seriesColumn) {
  const roleColours = new Map(ROLES.map((role) => [role, ROLE_COLOURS[role]]));
  return seriesLegend(rows, seriesColumn, roleColours, ROLE_LABELS);
}

/** Draw the CDFs of input, uncached input and output tokens per request, on a log axis. */
async function drawTokensPerRequest(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TOKEN_SERIES), { labels: TOKEN_SERIES, floor: MIN_TOKENS_DRAWN });
  await drawCdf(body, series, {
    xLabel: "Tokens", yLabel: "Share of requests", logX: true, format: formatTokens, xTickFormat: formatCountTick,
    colours: colours.series,
  });
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
    axisWithTicks(Plot.axisX, decadeTicks(xDomain), {
      ...AXIS_STYLE, label: "Messages in the request", tickFormat: formatCountTick,
    }),
    axisWithTicks(Plot.axisY, decadeTicks(yDomain), { ...AXIS_STYLE, label: "Median tokens", tickFormat: formatCountTick }),
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
  return `${TOKEN_PART_NAMES[point.part]}\n${messages}\n${median}\n${formatCount(point.rows)} requests`;
}

/** The token part colours as a map from part to colour, as the chart helpers take them. */
function tokenPartColours() {
  return new Map(Object.entries(TOKEN_PART_COLOURS));
}
