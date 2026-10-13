/**
 * The ranges kind: one row per tool category, in the order and the colours every chart gives the categories, of a
 * value's spread: a thin rule from the 5th to the 95th percentile, a thick bar from the 25th to the 75th and a tick at
 * the median, on a log axis ruled at its powers of ten; above it, the note on the asterisk a category's name may carry.
 *
 * Its rows are a quantile-range query's: one category per row, `category`, its percentiles `p5`, `p25`, `p50`, `p75`
 * and `p95`, and `rows`, the calls they are over.
 */

import { AXIS_STYLE, categoryRowsFrame, colourScale, GRID_STYLE, legendPlace, LINE_WIDTH } from "../shared/charts.js";
import { axisWithTicks, decadeTicks } from "../axes/ticks.js";
import { formatCount } from "../shared/format.js";

// The percentile columns of a quantile-range query, low to high, with the name the tooltip gives each.
const PERCENTILES = Object.freeze([
  Object.freeze({ column: "p5", label: "5th" }),
  Object.freeze({ column: "p25", label: "25th" }),
  Object.freeze({ column: "p50", label: "median" }),
  Object.freeze({ column: "p75", label: "75th" }),
  Object.freeze({ column: "p95", label: "95th" }),
]);

const WHISKER_WIDTH = 1; // pixels; the thin rule from the 5th to the 95th percentile
const BOX_WIDTH = 8; // pixels; the thick bar from the 25th to the 75th percentile
const MEDIAN_TICK_INSET = 4; // pixels taken off the top and bottom of a category's row by the median's tick
// The note over the chart: what the asterisk before a category's name means.
const ASTERISK_NOTE = "* a shell command, by its purpose";

/**
 * Draw `rows` into `body`, one row per category in the order of `colours.categories` (the category order every chart
 * shares, Other last), each in its category's colour, and the asterisk's note in the figure's legend place. It has no
 * series to hide. Its named parameters:
 * - `unitFactor`: the factor from the query's unit to the drawn one, `1 / 1000` for milliseconds drawn in seconds.
 * - `floor`: the smallest value drawn, in the drawn unit; a smaller one is drawn at it, on the log axis.
 * - `xLabel`: the value axis's title.
 * - `valueFormat`: how a value is written in the tooltip; `xTickFormat`: how a power of ten is written on the axis.
 */
export async function drawRanges(rows, body, colours, parameters) {
  const { unitFactor, floor, xLabel, valueFormat, xTickFormat } = parameters;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const categories = drawnCategories(rows, colours.categories);
  const ranges = drawnRanges(rows, unitFactor, floor);
  const ticks = rangeTicks(ranges);
  legendPlace(body).replaceChildren(asteriskNote());
  const chart = Plot.plot({
    ...categoryRowsFrame(body, categories.length),
    x: { type: "log" },
    y: { type: "band", domain: categories },
    color: colourScale(colours.categories, categories),
    marks: [
      // Only the powers of ten are ruled and labelled: a log axis's own ticks would draw a mesh of minor lines.
      Plot.gridX(ticks, GRID_STYLE),
      axisWithTicks(Plot.axisX, ticks, { ...AXIS_STYLE, label: xLabel, tickFormat: xTickFormat }),
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
      Plot.tip(ranges, Plot.pointerY({ y: "category", x: "p50", title: (drawn) => rangeTipText(drawn, unitFactor, valueFormat) })),
    ],
  });
  body.replaceChildren(chart);
}

/** The categories of `rows` in the order of `categoryColours` (a Map from category to colour), one row each. */
export function drawnCategories(rows, categoryColours) {
  const present = new Set(rows.map((row) => row.category));
  return [...categoryColours.keys()].filter((category) => present.has(category));
}

/**
 * Each row's percentiles in the drawn unit, times `unitFactor` and at least `floor`: `{ category, row, p5, …, p95 }`,
 * with the row they came from.
 */
export function drawnRanges(rows, unitFactor, floor) {
  const ranges = [];
  for (const row of rows) {
    const drawn = { category: row.category, row };
    for (const { column } of PERCENTILES) {
      drawn[column] = Math.max(row[column] * unitFactor, floor);
    }
    ranges.push(drawn);
  }
  return ranges;
}

/** The powers of ten from the smallest drawn 5th percentile to the largest 95th: the axis's ruled, labelled ticks. */
export function rangeTicks(ranges) {
  const low = Math.min(...ranges.map((drawn) => drawn.p5));
  const high = Math.max(...ranges.map((drawn) => drawn.p95));
  return decadeTicks([low, high]);
}

/** A category's tooltip: its name, its calls, and each percentile in the drawn unit, as `valueFormat` writes it. */
export function rangeTipText(drawn, unitFactor, valueFormat) {
  const lines = [drawn.category, `${formatCount(drawn.row.rows)} calls`];
  for (const { column, label } of PERCENTILES) {
    lines.push(`${label}: ${valueFormat(drawn.row[column] * unitFactor)}`);
  }
  return lines.join("\n");
}

// The note on the asterisk, as one item of the figure's legend place.
function asteriskNote() {
  const note = document.createElement("span");
  note.className = "legend-item";
  note.textContent = ASTERISK_NOTE;
  return note;
}
