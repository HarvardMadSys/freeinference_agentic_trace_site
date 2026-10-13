/**
 * The Tools section of the Explore page's figures: how long a tool call waits and how much it returns, per category,
 * how requests batch their calls, drawn in `tools_batching.js`, and the tool mix along a turn, human-driven against
 * benchmark, drawn in `comparison/tool_mix.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of a quantile-range query is one
 * category, its count in `rows`, so a thin one is hidden whole.
 */

import {
  AXIS_STYLE, categoryRowsFrame, colourScale, GRID_STYLE, legendPlace, LINE_WIDTH, TIP_STYLE,
} from "../shared/charts.js";
import { axisWithTicks, decadeTicks } from "../axes/ticks.js";
import {
  formatCompactCount, formatCount, formatCountTick, formatSeconds, MILLISECONDS_PER_SECOND,
} from "../shared/format.js";
import { CALLS_PER_REQUEST_BY_CATEGORY, LATENCY_BY_BATCH_WIDTH } from "./tools_batching.js";
import { TOOL_MIX_BY_TURN_POSITION } from "../comparison/tool_mix.js";

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
  xLabel: "Seconds",
  scale: 1 / MILLISECONDS_PER_SECOND,
  floor: 0.1, // seconds; as in the paper, whose axis starts at 100 ms
  format: formatSeconds,
  tickFormat: String,
});
const RESULT_TOKENS_RANGE = Object.freeze({
  xLabel: "Tokens",
  scale: 1,
  floor: 1, // an empty result is drawn at one token, below the shortest messages
  format: formatCompactCount,
  tickFormat: formatCountTick,
});

const WHISKER_WIDTH = 1; // pixels; the thin rule from the 5th to the 95th percentile
const BOX_WIDTH = 8; // pixels; the thick bar from the 25th to the 75th percentile
const MEDIAN_TICK_INSET = 4; // pixels taken off the top and bottom of a category's row by the median's tick
// The note over a quantile-range chart: what the asterisk before a category's name means.
const ASTERISK_NOTE = "* a shell command, by its purpose";

/** The Tools topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Most requests call one tool; calling tools together can reduce total waiting time.";

/** The figures of the Tools section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "latency_by_category",
    title: "Tool latency by category",
    insight: "Even simple tools can have surprisingly long delays.",
    definition: "Tool wait times by category, counting only requests that call one tool. Wait time starts when the model response ends and stops at the next request; boxes show the middle 50% and whiskers show the 5th–95th percentiles. An asterisk marks shell commands grouped by what they do.",
    caption: "Read, Edit, Search, and File Ops have median latencies near one second, while Build/Test and Subagent calls take much longer. Long tails mean even fast categories occasionally stall for minutes.",
    query: "figures/latency_by_category",
    binColumn: "category",
    draw: (rows, body, colours) => drawQuantileRanges(rows, body, colours.categories, LATENCY_RANGE),
  }),
  Object.freeze({
    name: "result_tokens_by_category",
    title: "Tool result size by category",
    insight: "Reading code contributes far more context than writing it.",
    definition: "Tokens returned by each tool category, counting only calls with a known result. Boxes show the middle 50% and whiskers show the 5th–95th percentiles. An asterisk marks shell commands grouped by what they do.",
    caption: "Read operations produce 33.9% of tool-result tokens despite accounting for only 16.3% of calls. Edit and Write operations typically return fewer than 50 tokens.",
    query: "figures/result_tokens_by_category",
    binColumn: "category",
    draw: (rows, body, colours) => drawQuantileRanges(rows, body, colours.categories, RESULT_TOKENS_RANGE),
  }),
  CALLS_PER_REQUEST_BY_CATEGORY,
  LATENCY_BY_BATCH_WIDTH,
  TOOL_MIX_BY_TURN_POSITION,
]);

/**
 * Draw one row per category, in the order of `categoryColours` (the global category order, Other last) and in its
 * tool group's colour: a thin rule from the 5th to the 95th percentile, a thick bar from the 25th to the 75th, and a
 * tick at the median; above it, the note on the asterisk.
 */
async function drawQuantileRanges(rows, body, categoryColours, range) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const present = new Set(rows.map((row) => row.category));
  const categories = [...categoryColours.keys()].filter((category) => present.has(category));
  const ranges = rows.map((row) => drawnRange(row, range));
  const note = document.createElement("span");
  note.className = "legend-item";
  note.textContent = ASTERISK_NOTE;
  legendPlace(body).replaceChildren(note);
  const chart = Plot.plot({
    ...categoryRowsFrame(body, categories.length),
    x: { type: "log" },
    y: { type: "band", domain: categories },
    color: colourScale(categoryColours, categories),
    marks: [
      // Only the powers of ten are ruled and labelled: a log axis's own ticks would draw a mesh of minor lines.
      Plot.gridX(powersOfTen(ranges), GRID_STYLE),
      axisWithTicks(Plot.axisX, powersOfTen(ranges), {
        ...AXIS_STYLE, label: range.xLabel, tickFormat: range.tickFormat,
      }),
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
  return decadeTicks([low, high]);
}

function rangeTipText(drawn, range) {
  const lines = [drawn.category, `${formatCount(drawn.row.rows)} calls`];
  for (const { column, label } of PERCENTILES) {
    lines.push(`${label}: ${range.format(drawn.row[column] * range.scale)}`);
  }
  return lines.join("\n");
}
