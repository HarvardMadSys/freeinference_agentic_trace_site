/**
 * The Tools section of the Explore page's figures: how long a tool call waits and how much it returns, per category,
 * and how requests batch their calls. The batching figures are drawn in `tools_batching.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of a quantile-range query is one
 * category, its count in `rows`, so a thin one is hidden whole.
 */

import { AXIS_STYLE, categoryRowsFrame, colourScale, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import { formatCount, formatSeconds, formatTokens, MILLISECONDS_PER_SECOND } from "../shared/format.js";
import { CALLS_PER_REQUEST_BY_CATEGORY, LATENCY_BY_BATCH_WIDTH } from "./tools_batching.js";

// The percentile columns of a quantile-range query, low to high, with the name the tooltip gives each.
const PERCENTILES = Object.freeze([
  Object.freeze({ column: "p5", label: "5th" }),
  Object.freeze({ column: "p25", label: "25th" }),
  Object.freeze({ column: "p50", label: "median" }),
  Object.freeze({ column: "p75", label: "75th" }),
  Object.freeze({ column: "p95", label: "95th" }),
]);

// How each quantile-range chart draws its values: the axis label, the factor from the query's unit to the drawn
// one, the smallest value drawn on the log axis (a smaller one is drawn at it), how the tooltip writes a value, and
// how the axis writes a power of ten.
const LATENCY_RANGE = Object.freeze({
  xLabel: "Seconds after the request",
  scale: 1 / MILLISECONDS_PER_SECOND,
  floor: 0.1, // seconds; as in the paper, whose axis starts at 100 ms
  format: formatSeconds,
  tickFormat: String,
});
const RESULT_TOKENS_RANGE = Object.freeze({
  xLabel: "Result tokens",
  scale: 1,
  floor: 1, // an empty result is drawn at one token, below the shortest messages
  format: formatTokens,
  tickFormat: formatTokens,
});

const WHISKER_WIDTH = 1; // pixels; the thin rule from the 5th to the 95th percentile
const BOX_WIDTH = 8; // pixels; the thick bar from the 25th to the 75th percentile
const MEDIAN_TICK_INSET = 4; // pixels taken off the top and bottom of a category's row by the median's tick

/** The figures of the Tools section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "latency_by_category",
    title: "Tool latency by category",
    definition: "The 5th, 25th, 50th, 75th and 95th percentile of a tool call's latency (the wait after its request until the session's next) per category, over calls that were their request's only call, where the paper also marks the mean.",
    query: "figures/latency_by_category",
    binColumn: "category",
    draw: drawLatency,
  }),
  Object.freeze({
    name: "result_tokens_by_category",
    title: "Tool result size by category",
    definition: "The 5th, 25th, 50th, 75th and 95th percentile of the tokens of a tool call's result per category, over calls whose result was matched, where the paper also marks the mean.",
    query: "figures/result_tokens_by_category",
    binColumn: "category",
    draw: drawResultTokens,
  }),
  CALLS_PER_REQUEST_BY_CATEGORY,
  LATENCY_BY_BATCH_WIDTH,
]);

/** Draw each category's latency percentiles, in seconds on a log axis. */
async function drawLatency(rows, body, colours) {
  await drawQuantileRanges(rows, body, colours.categories, LATENCY_RANGE);
}

/** Draw each category's result token percentiles, on a log axis. */
async function drawResultTokens(rows, body, colours) {
  await drawQuantileRanges(rows, body, colours.categories, RESULT_TOKENS_RANGE);
}

/**
 * Draw one row per category, in the order of `categoryColours` (the global category order) and in its colour: a
 * thin rule from the 5th to the 95th percentile, a thick bar from the 25th to the 75th, and a tick at the median.
 */
async function drawQuantileRanges(rows, body, categoryColours, range) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const present = new Set(rows.map((row) => row.category));
  const categories = [...categoryColours.keys()].filter((category) => present.has(category));
  const ranges = rows.map((row) => drawnRange(row, range));
  const chart = Plot.plot({
    ...categoryRowsFrame(body, categories.length),
    x: { type: "log" },
    y: { type: "band", domain: categories },
    color: colourScale(categoryColours, categories),
    marks: [
      Plot.gridX(GRID_STYLE),
      // The labels are given as text: a narrow log axis's own tick format would leave all but one power of ten bare.
      Plot.axisX(powersOfTen(ranges), { ...AXIS_STYLE, label: range.xLabel, text: range.tickFormat }),
      Plot.axisY({ ...AXIS_STYLE, label: null }),
      Plot.ruleY(ranges, { y: "category", x1: "p5", x2: "p95", stroke: "category", strokeWidth: WHISKER_WIDTH }),
      Plot.ruleY(ranges, { y: "category", x1: "p25", x2: "p75", stroke: "category", strokeWidth: BOX_WIDTH }),
      Plot.tickX(ranges, {
        y: "category",
        x: "p50",
        stroke: "currentColor", // the chart's label ink, never a series colour
        strokeWidth: LINE_WIDTH,
        insetTop: MEDIAN_TICK_INSET,
        insetBottom: MEDIAN_TICK_INSET,
      }),
      Plot.tip(ranges, Plot.pointerY({ ...TIP_STYLE, y: "category", x: "p50", title: (drawn) => rangeTipText(drawn, range) })),
    ],
  });
  body.replaceChildren(chart);
}

/** A category's percentiles in the drawn unit, each at least the range's floor, with the row they came from. */
function drawnRange(row, range) {
  const drawn = { category: row.category, row };
  for (const { column } of PERCENTILES) {
    drawn[column] = Math.max(row[column] * range.scale, range.floor);
  }
  return drawn;
}

/** The powers of ten from the smallest drawn 5th percentile to the largest 95th, the range axis's labelled ticks. */
function powersOfTen(ranges) {
  const low = Math.min(...ranges.map((drawn) => drawn.p5));
  const high = Math.max(...ranges.map((drawn) => drawn.p95));
  const powers = [];
  for (let exponent = Math.ceil(Math.log10(low)); exponent <= Math.floor(Math.log10(high)); exponent += 1) {
    powers.push(10 ** exponent);
  }
  return powers;
}

function rangeTipText(drawn, range) {
  const lines = [drawn.category, `${formatCount(drawn.row.rows)} calls`];
  for (const { column, label } of PERCENTILES) {
    lines.push(`${label}: ${range.format(drawn.row[column] * range.scale)}`);
  }
  return lines.join("\n");
}
