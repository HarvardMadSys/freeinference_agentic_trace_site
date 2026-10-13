/**
 * The Tools figures of batching: how many calls a request makes, by the category of its first call, and how long a
 * request's calls keep the session waiting, by how many it made at once.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of the calls-per-request query is one
 * category, its requests in `rows`; every row of the batch-width query is one width, its requests in `rows`; so a thin
 * category or width is hidden whole.
 */

import {
  AXIS_STYLE, categoryRowsFrame, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, TALL_CHART_HEIGHT, TIP_STYLE,
} from "../shared/charts.js";
import { TICK_COUNT, tickCountFor } from "../axes/ticks.js";
import { BATCH_COLOURS } from "../theme/colours.js";
import { formatCount, formatDurationTick, formatSeconds } from "../shared/format.js";
import { partsLegend } from "./figure_rows.js";

/** The widest width the batch-width query draws on its own; requests of more calls are drawn with it. */
export const WIDEST_DRAWN = 8;
const WIDTH_TICKS = Object.freeze([1, 2, 4, 6, WIDEST_DRAWN]); // at most six labelled widths

// The lines of the batch-width figure, by their name in its legend, with the label each is drawn under: the batched
// calls' median line and its two bands, and the same calls made one by one.
const BATCH_LINES = Object.freeze({
  batched: "Batched calls: median, p25–p75, p10–p90",
  serial: "Same calls one by one",
});

const OUTER_BAND_OPACITY = 0.15; // the band from the 10th to the 90th percentile of the tool wait
const INNER_BAND_OPACITY = 0.35; // the band from the 25th to the 75th
const HEADROOM = 1.05; // the wait axis reaches this far past the highest band or serial point
const MEAN_CALLS_HEADROOM = 1.08; // the calls axis reaches this far past the highest mean
const MIN_CALLS_AXIS_END = 1.5; // the calls axis reaches at least this far, so a short bar still reads as short
const CALLS_TICKS = 5; // about this many ticks on the calls axis
const ONE_CALL = 1; // the width axis starts at one call, the fewest a request with a call makes

/** The calls-per-request figure: the mean calls of the requests whose first call is of each category. */
export const CALLS_PER_REQUEST_BY_CATEGORY = Object.freeze({
  name: "calls_per_request_by_category",
  title: "Calls per request by category",
  insight: "Agents rarely exploit parallel tool execution.",
  definition: "The average number of tool calls per main-session request, grouped by the first tool’s category. Each request counts once. Requests whose first tool is Ask User are excluded.",
  caption: "Among tool-calling requests, 84.5% issue just one tool call and only 3.3% issue four or more. Batching appears in many sessions but remains infrequent at the request level.",
  query: "figures/calls_per_request_by_category",
  binColumn: "category",
  draw: drawCallsPerRequest,
});

/** The batch-width figure: the tool wait of requests by their number of calls, against making the calls one by one. */
export const LATENCY_BY_BATCH_WIDTH = Object.freeze({
  name: "latency_by_batch_width",
  title: "Tool latency by batch width",
  insight: "Running more tools together adds surprisingly little waiting time.",
  definition: "Tool wait times by number of calls per request, excluding Ask User and grouping eight or more calls together. Bands show the 10th–90th percentiles. The comparison estimates time for separate calls: number of calls × (median tool wait + median model response time), using requests with one call.",
  caption: "Batched tool latency remains relatively flat as the number of concurrent calls increases, while estimated serial execution grows with each additional LLM–tool round trip.",
  drawsLines: true,
  query: "figures/latency_by_batch_width",
  binColumn: "width",
  legend: batchLegend,
  draw: drawLatencyByWidth,
});

/** The batch-width figure's legend: the batched calls in the colour of a tool wait, the serial line in ink. */
export function batchLegend() {
  return partsLegend(BATCH_LINES, new Map(Object.entries(BATCH_COLOURS)));
}

/** A width as its axis and tooltip write it: "3", or "8+" for the widest, which holds every wider request too. */
export function widthLabel(width) {
  return width === WIDEST_DRAWN ? `${width}+` : String(width);
}

/** The top of the wait axis: past the highest point of the lines in `shown`, the 90th percentile or the serial line. */
export function waitAxisEnd(rows, shown) {
  let highest = 0;
  for (const row of rows) {
    if (shown.has("batched")) {
      highest = Math.max(highest, row.p90);
    }
    if (shown.has("serial")) {
      highest = Math.max(highest, row.serial_s);
    }
  }
  return highest * HEADROOM;
}

/** Draw each category's mean calls per request as a bar from zero, most calls at the top. */
async function drawCallsPerRequest(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const categories = rows.map((row) => row.category); // the query's order: most calls first
  const highest = Math.max(...rows.map((row) => row.mean_calls));
  const frame = categoryRowsFrame(body, categories.length);
  const ticks = tickCountFor(frame.width, CALLS_TICKS);
  const chart = Plot.plot({
    ...frame,
    // From zero, as every bar chart starts, so a bar's length is its mean.
    x: { domain: [0, Math.max(MIN_CALLS_AXIS_END, highest * MEAN_CALLS_HEADROOM)] },
    y: { type: "band", domain: categories },
    color: colourScale(colours.categories, categories),
    marks: [
      Plot.gridX({ ...GRID_STYLE, ticks }),
      Plot.axisX({ ...AXIS_STYLE, ticks, label: "Calls" }),
      Plot.axisY({ ...AXIS_STYLE, label: null }),
      Plot.barX(rows, { y: "category", x1: 0, x2: "mean_calls", fill: "category" }),
      Plot.tip(rows, Plot.pointerY({ ...TIP_STYLE, y: "category", x: "mean_calls", title: callsTipText })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * Draw the tool wait's bands and median per width, and the serial line dashed, each line left out when `hidden` names
 * it.
 */
async function drawLatencyByWidth(rows, body, colours, hidden) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const shown = new Set(Object.keys(BATCH_LINES).filter((line) => !hidden.has(line)));
  const batched = colours.series.get("batched");
  const marks = [Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT })];
  if (shown.has("batched")) {
    marks.push(
      Plot.areaY(rows, { x: "width", y1: "p10", y2: "p90", fill: batched, fillOpacity: OUTER_BAND_OPACITY }),
      Plot.areaY(rows, { x: "width", y1: "p25", y2: "p75", fill: batched, fillOpacity: INNER_BAND_OPACITY }),
      Plot.line(rows, { x: "width", y: "p50", stroke: batched, strokeWidth: LINE_WIDTH }),
    );
  }
  if (shown.has("serial")) {
    const serial = colours.series.get("serial");
    marks.push(Plot.line(rows, {
      x: "width", y: "serial_s", stroke: serial, strokeWidth: LINE_WIDTH, strokeDasharray: DASH,
    }));
  }
  marks.push(
    Plot.axisX({ ...AXIS_STYLE, ticks: WIDTH_TICKS, tickFormat: widthLabel, label: "Calls in the request" }),
    Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: formatDurationTick, label: null }),
    Plot.tip(rows, Plot.pointerX({ ...TIP_STYLE, x: "width", y: "p50", title: widthTipText })),
  );
  const chart = Plot.plot({
    ...chartFrame(body),
    height: TALL_CHART_HEIGHT, // as tall as the calls-per-request chart beside it
    x: { domain: [ONE_CALL, WIDEST_DRAWN] },
    y: { domain: [0, waitAxisEnd(rows, shown)] },
    marks,
  });
  body.replaceChildren(chart);
}

function callsTipText(row) {
  return `${row.category}\n${row.mean_calls.toFixed(2)} calls per request\n${formatCount(row.rows)} requests`;
}

function widthTipText(row) {
  return [
    `${widthLabel(row.width)} ${row.width === 1 ? "call" : "calls"} · ${formatCount(row.rows)} requests`,
    `median ${formatSeconds(row.p50)}`,
    `25th to 75th: ${formatSeconds(row.p25)} to ${formatSeconds(row.p75)}`,
    `10th to 90th: ${formatSeconds(row.p10)} to ${formatSeconds(row.p90)}`,
    `same calls one by one: ${formatSeconds(row.serial_s)}`,
  ].join("\n");
}
