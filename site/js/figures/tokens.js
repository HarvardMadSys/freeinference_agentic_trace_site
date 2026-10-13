/**
 * The Tokens-and-cost section of the Explore page's figures: how many tokens a request holds, how they split between
 * cached input, uncached input and output, how they grow with the context, which roles fill the input, how much of a
 * request's input is cached, and how a session's cost splits, drawn in `sessions_ranked.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, distinct, drawBars, GRID_STYLE, LINE_WIDTH,
} from "../shared/charts.js";
import { drawCdfSeries } from "../shared/cdf.js";
import { cdfSeries } from "../charts/cdf.js";
import { drawHistogram } from "../charts/histogram.js";
import { axisWithTicks, decadeDomain, decadeTicks, sparseTickFormat, weekTickFormat } from "../axes/ticks.js";
import { ROLE_COLOURS, TOKEN_PART_COLOURS, VIOLET_SLOT } from "../theme/colours.js";
import {
  formatBinaryThousands, formatCompactCount, formatCount, formatCountTick, formatPercent, formatShare,
} from "../shared/format.js";
import { INPUT_ROLES, TOKEN_PART_NAMES } from "../session/token_parts.js";
import { partsLegend, seriesLegend } from "../shared/series.js";
import { COST_SHARE_BY_SESSION } from "./sessions_ranked.js";

// The series of the tokens-per-request CDF, by their name in the query, with the name each is drawn under.
const TOKEN_SERIES = Object.freeze({
  input: "Input", uncached: TOKEN_PART_NAMES.uncached, output: TOKEN_PART_NAMES.output,
});
// Their colours: the two token parts in theirs, and the input, the whole prompt and not a part of it, in violet.
const TOKEN_SERIES_COLOURS = Object.freeze({
  input: VIOLET_SLOT, uncached: TOKEN_PART_COLOURS.uncached, output: TOKEN_PART_COLOURS.output,
});

// The token parts the growth figure draws a line for, in its legend's order.
const TOKEN_PARTS = Object.freeze(["cached", "uncached", "output"]);

// The median column of each token part in the token growth query.
const GROWTH_COLUMNS = Object.freeze({
  cached: "median_cached_tokens",
  uncached: "median_uncached_tokens",
  output: "median_output_tokens",
});

const MIN_TOKENS_DRAWN = 1; // a token count below one (a request with nothing uncached) is drawn at one, on the log axis
const MARKER_RADIUS = 3; // pixels; the small markers on the token growth lines
const MAX_BAR_LABELS = 5; // a bar chart's axis labels at most this many bars, so the labels fit a phone's width

// The cached-share histogram's stats query: the median, 95th percentile and count its bins are summarised by.
const CACHED_FRACTION_STATS_QUERY = "explore/cached_fraction_stats";

/** The Tokens-and-cost topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Most input tokens are cached, and cache reads account for most API cost at the stated prices.";

/** The figures of the Tokens-and-cost section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "tokens_per_request_cdf",
    title: "Tokens per request",
    insight: "Huge inputs don't necessarily mean huge computation.",
    definition: "Each line shows the percentage of requests with this many tokens or fewer, for total input, uncached input, and output. Uncached input counts only requests with reported cache usage. Output excludes responses with one token or fewer.",
    caption: "A median request carries 129K input tokens, but only about 500 are uncached and require fresh processing. Outputs contain just a few hundred tokens.",
    drawsLines: true,
    query: "figures/tokens_per_request_cdf",
    binColumn: "series",
    seriesColumn: "series",
    seriesOverSameRows: true,
    legend: (rows, colours, seriesColumn) =>
      seriesLegend(rows, seriesColumn, new Map(Object.entries(TOKEN_SERIES_COLOURS)), TOKEN_SERIES),
    draw: drawTokensPerRequest,
  }),
  Object.freeze({
    name: "token_split_by_week",
    title: "Token split by week",
    insight: "Most token traffic is the same context being read again and again.",
    definition: "Each bar shows the percentages of cached input, uncached input, and output tokens in one week. Only requests with reported cache usage are included. Tokens are counted equally, regardless of price.",
    caption: "Cached input dominates the token mix across weeks. Overall, cached input accounts for 97.4% of token volume among requests with reported cache usage, far exceeding fresh input and output.",
    query: "figures/token_split_by_week",
    binColumn: "week",
    seriesColumn: "part",
    legend: (rows, colours, seriesColumn) =>
      seriesLegend(rows, seriesColumn, new Map(Object.entries(TOKEN_PART_COLOURS)), TOKEN_PART_NAMES),
    draw: drawTokenSplit,
  }),
  Object.freeze({
    name: "token_growth_by_messages",
    title: "Token growth with the context",
    insight: "Contexts keep growing, but each step adds surprisingly little.",
    definition: "Median cached input, uncached input, and output tokens per request, grouped by how many messages the request contains. The groups are 1 message, 2–3 messages, 4–7 messages, and so on.",
    caption: "As request histories grow, cached input reaches hundreds of thousands of tokens, while newly processed input falls toward roughly 1K tokens and output remains near 200 tokens per request.",
    drawsLines: true,
    query: "figures/token_growth_by_messages",
    binColumn: "bin_start",
    legend: () => partsLegend(TOKEN_PART_NAMES, new Map(Object.entries(TOKEN_PART_COLOURS))),
    draw: drawTokenGrowth,
  }),
  Object.freeze({
    name: "context_share_by_role",
    title: "Context share by role",
    insight: "The agent's own responses eventually dominate its context.",
    definition: "Each bar shows the percentage of input tokens from system instructions, users, the assistant, tool results, and tool definitions. Requests are grouped by input size, with each group twice the size of the previous one. Here, 4k means 4,096 tokens.",
    caption: "System prompts dominate initially, followed by growing tool results. In longer contexts, tool history is pruned while assistant messages continue accumulating and become the largest component.",
    query: "figures/context_share_by_role",
    binColumn: "bin_start",
    seriesColumn: "role",
    legend: contextShareLegend,
    draw: drawContextShare,
  }),
  Object.freeze({
    name: "cached_fraction_per_request",
    title: "Cached share per request",
    insight: "Cache hits are the norm, not the exception.",
    definition: "The percentage of each request’s input tokens read from cache, grouped into 5% ranges. Only main-session requests with reported cache usage are included. The vertical axis counts requests on a log scale.",
    caption: "Requests typically reuse nearly all their input tokens. Across requests with reported cache usage, cached tokens account for more than 97% of total token volume.",
    query: "explore/cached_fraction_bins",
    statsQuery: CACHED_FRACTION_STATS_QUERY,
    draw: (rows, body, colours) => drawHistogram(rows, body, colours, {
      statsQuery: CACHED_FRACTION_STATS_QUERY,
      countLabel: "Requests",
      xLabel: null,
      valueFormat: formatShare,
      xTickFormat: formatPercent,
      logScale: false,
      logCounts: true,
      showsMaximum: false,
    }),
  }),
  COST_SHARE_BY_SESSION,
]);

/** The context share's legend: the input roles, in their stacking order and their colours. */
function contextShareLegend(rows, colours, seriesColumn) {
  const roleColours = new Map();
  const roleNames = {};
  for (const inputRole of INPUT_ROLES) {
    roleColours.set(inputRole.role, ROLE_COLOURS[inputRole.role]);
    roleNames[inputRole.role] = inputRole.name;
  }
  return seriesLegend(rows, seriesColumn, roleColours, roleNames);
}

/** Draw the CDFs of input, uncached input and output tokens per request, on a log axis. */
async function drawTokensPerRequest(rows, body, colours) {
  const series = cdfSeries(rows, Object.keys(TOKEN_SERIES), { labels: TOKEN_SERIES, floor: MIN_TOKENS_DRAWN });
  await drawCdfSeries(body, series, {
    xLabel: "Tokens", yLabel: "Share of requests", logX: true, format: formatCompactCount, xTickFormat: formatCountTick,
    colours: colours.series,
  });
}

/** Draw one stacked bar per week of its cached, uncached and output shares. */
async function drawTokenSplit(rows, body, colours) {
  await drawBars(body, rows, {
    x: "week",
    y: "share",
    fill: "part",
    colours: colours.series,
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
    colours: colours.series,
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
    Plot.tip(points, Plot.pointer({ x: "messages", y: "tokens", title: growthTipText })),
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

/**
 * One point per bin and part of `parts` (the parts shown) with a median: `{ part, messages, tokens, median, rows }`,
 * each part's points in bin order.
 */
export function growthPoints(rows, parts) {
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
  const median = `median ${formatCompactCount(point.median)} tokens`;
  return `${TOKEN_PART_NAMES[point.part]}\n${messages}\n${median}\n${formatCount(point.rows)} requests`;
}
