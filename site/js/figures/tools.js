/**
 * The Tools section of the Paper figures page: which tools agents call, how many at once, how long each one waits
 * and how much each one returns.
 *
 * Each figure is `{ name, title, definition, query, binColumn, isWide, draw }`, as in the Sessions section: every row
 * of a tool query is one category or one number of calls, its count in `rows`, so a thin one is hidden whole; a
 * figure that `isWide` takes the whole width of its section's grid.
 */

import { AXIS_STYLE, assignColours, chartFrame, colourScale, drawBars, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import {
  formatCount, formatOptionalShare, formatSeconds, formatShare, formatTokens, MILLISECONDS_PER_SECOND, MISSING_TEXT,
} from "../shared/format.js";

// The tool overview's columns, left to right: the heading, the query's column, how a cell is written, and whether
// the cell is a number (set right-aligned).
const OVERVIEW_COLUMNS = Object.freeze([
  Object.freeze({ heading: "Category", column: "category", format: String, isNumber: false }),
  Object.freeze({ heading: "Calls", column: "rows", format: formatCount, isNumber: true }),
  Object.freeze({ heading: "Share of calls", column: "share_of_calls", format: formatShare, isNumber: true }),
  Object.freeze({ heading: "Sessions", column: "sessions", format: formatCount, isNumber: true }),
  Object.freeze({ heading: "Failed", column: "failed_share", format: formatOptionalShare, isNumber: true }),
  Object.freeze({ heading: "Median latency", column: "median_latency_ms", format: optionalMilliseconds, isNumber: true }),
  Object.freeze({ heading: "Median result", column: "median_result_tokens", format: optionalTokens, isNumber: true }),
]);

// The one series of the calls-per-request bars, named as its tooltip names it.
const REQUESTS_SERIES = "Requests";

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
const CATEGORY_ROW_HEIGHT = 22; // pixels per category, so sixteen categories keep readable labels
const CATEGORY_MARGIN_LEFT = 96; // pixels; room for the longest category name, "*Interpreter"
const RANGE_MARGINS_Y = 60; // pixels above and below the rows: the frame's top margin and the x axis

/** The figures of the Tools section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "tool_overview",
    title: "Tool categories",
    definition: "Per tool category: its calls and share of calls, the sessions that called it, the share of its calls with an outcome that failed (an error, a denial or a timeout), its median latency over calls that were their request's only call, and its median result tokens, where the paper gives shares of sessions, result tokens and wait, and the batch mix.",
    query: "figures/tool_overview",
    binColumn: "category",
    isWide: true,
    draw: drawOverview,
  }),
  Object.freeze({
    name: "calls_per_request",
    title: "Tool calls per request",
    definition: "Share of the requests that emitted tool calls by how many they emitted, nine or more counted together, where the paper counts calls, a request of three calls counting three times, and puts four or more together.",
    query: "figures/calls_per_request",
    binColumn: "tool_calls",
    draw: drawCallsPerRequest,
  }),
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
]);

/** Draw the tool overview as a table, one row per category, most calls first. */
async function drawOverview(rows, body) {
  const table = document.createElement("table");
  table.className = "data-table is-static";
  const headingRow = table.createTHead().insertRow();
  for (const { heading, isNumber } of OVERVIEW_COLUMNS) {
    const cell = document.createElement("th");
    cell.textContent = heading;
    cell.classList.toggle("is-number", isNumber);
    headingRow.append(cell);
  }
  const tableBody = table.createTBody();
  for (const row of rows) {
    const tableRow = tableBody.insertRow();
    for (const { column, format, isNumber } of OVERVIEW_COLUMNS) {
      const cell = tableRow.insertCell();
      cell.textContent = format(row[column]);
      cell.classList.toggle("is-number", isNumber);
    }
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap"; // a phone scrolls the table sideways, not the page
  wrap.append(table);
  body.replaceChildren(wrap);
}

/** Draw one bar per number of calls of its share of the requests that emitted calls. */
async function drawCallsPerRequest(rows, body) {
  const bars = rows.map((row) => ({ ...row, series: REQUESTS_SERIES }));
  await drawBars(body, bars, {
    x: "tool_calls",
    y: "share",
    fill: "series",
    colours: assignColours([REQUESTS_SERIES]),
    xLabel: "Tool calls the request emitted",
    yLabel: "Share of requests",
    format: formatShare,
  });
}

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
    ...chartFrame(body),
    height: categories.length * CATEGORY_ROW_HEIGHT + RANGE_MARGINS_Y,
    marginLeft: CATEGORY_MARGIN_LEFT,
    x: { type: "log" },
    y: { type: "band", domain: categories },
    color: colourScale(categoryColours, categories, false),
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

// A median with no value, such as the latency of a category whose every call was batched, is shown as `MISSING_TEXT`.
function optionalMilliseconds(milliseconds) {
  return milliseconds === null ? MISSING_TEXT : formatSeconds(milliseconds / MILLISECONDS_PER_SECOND);
}

function optionalTokens(tokens) {
  return tokens === null ? MISSING_TEXT : formatTokens(tokens);
}
