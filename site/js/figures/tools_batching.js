/**
 * The Tools figures of batching: how many calls a request makes, by the category of its first call, and how long a
 * request's calls keep the session waiting, by how many it made at once.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of the calls-per-request query is one
 * category, its requests in `rows`; every row of the batch-width query is one width, its requests in `rows`; so a thin
 * category or width is hidden whole.
 */

import {
  AXIS_STYLE, categoryRowsFrame, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, TIP_STYLE,
} from "../shared/charts.js";
import { BATCH_COLOURS } from "../theme/colours.js";
import { formatCount, formatDurationTick, formatSeconds } from "../shared/format.js";
import { partsLegend } from "./figure_rows.js";

/** The widest width the batch-width query draws on its own; requests of more calls are drawn with it. */
export const WIDEST_DRAWN = 8;
const WIDTH_TICKS = Object.freeze([1, 2, 4, 6, WIDEST_DRAWN]); // at most six labelled widths

// The lines of the batch-width figure, by their name in its legend, with the label each is drawn under.
const BATCH_LINES = Object.freeze({ batched: "Batched calls", serial: "One call per request" });

const OUTER_BAND_OPACITY = 0.15; // the band from the 10th to the 90th percentile of the tool wait
const INNER_BAND_OPACITY = 0.35; // the band from the 25th to the 75th
const HEADROOM = 1.05; // the wait axis reaches this far past the highest band or serial point
const MEAN_CALLS_HEADROOM = 1.08; // the calls axis reaches this far past the highest mean
const MIN_CALLS_AXIS_END = 1.5; // the calls axis reaches at least this far, so a short bar still reads as short
const CALLS_TICKS = 5; // about this many ticks on the calls axis
const ONE_CALL = 1; // every bar and the width axis start at one call, the fewest a request with a call makes

/** The calls-per-request figure: the mean calls of the requests whose first call is of each category. */
export const CALLS_PER_REQUEST_BY_CATEGORY = Object.freeze({
  name: "calls_per_request_by_category",
  title: "Calls per request by category",
  definition: "The mean number of calls of the top-level requests whose first call is of each category, Ask User left out, each request counted once.",
  caption: "Mean calls per request, by the category of the request's first call.",
  query: "figures/calls_per_request_by_category",
  binColumn: "category",
  draw: drawCallsPerRequest,
});

/** The batch-width figure: the tool wait of requests by their number of calls, against making the calls one by one. */
export const LATENCY_BY_BATCH_WIDTH = Object.freeze({
  name: "latency_by_batch_width",
  title: "Tool latency by batch width",
  definition: "The 10th, 25th, 50th, 75th and 90th percentile of the tool wait (the gap before the session's next request, when that request waited for a tool, a person's answer to a question or a subagent) of top-level requests with no Ask User call, by their number of calls, eight or more drawn together; and the serial line, that number times the median tool wait plus the median latency of one-call requests, as if each call took a request of its own.",
  caption: "Tool wait by the number of calls a request made at once, against one call per request.",
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

/** Draw each category's mean calls per request as a bar from one call, most calls at the top. */
async function drawCallsPerRequest(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const categories = rows.map((row) => row.category); // the query's order: most calls first
  const highest = Math.max(...rows.map((row) => row.mean_calls));
  const chart = Plot.plot({
    ...categoryRowsFrame(body, categories.length),
    x: { domain: [ONE_CALL, Math.max(MIN_CALLS_AXIS_END, highest * MEAN_CALLS_HEADROOM)] },
    y: { type: "band", domain: categories },
    color: colourScale(colours.categories, categories),
    marks: [
      Plot.gridX({ ...GRID_STYLE, ticks: CALLS_TICKS }),
      Plot.axisX({ ...AXIS_STYLE, ticks: CALLS_TICKS, label: "Calls" }),
      Plot.axisY({ ...AXIS_STYLE, label: null }),
      Plot.barX(rows, { y: "category", x1: ONE_CALL, x2: "mean_calls", fill: "category" }),
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
  const marks = [Plot.gridY(GRID_STYLE)];
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
    Plot.axisY({ ...AXIS_STYLE, tickFormat: formatDurationTick, label: null }),
    Plot.tip(rows, Plot.pointerX({ ...TIP_STYLE, x: "width", y: "p50", title: widthTipText })),
  );
  const chart = Plot.plot({
    ...chartFrame(body),
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
    `one call per request: ${formatSeconds(row.serial_s)}`,
  ].join("\n");
}
