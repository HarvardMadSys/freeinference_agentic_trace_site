/**
 * The Sessions figures of latency: per model, the CDFs of a request's time to first token and of its decode time, each
 * for the five models with most requests in the selection that are among the eight with most requests over every
 * week, over requests whose TTFT is trusted; and the speed-up of the sessions' machine time if one of its parts alone
 * ran twice as fast.
 *
 * Their figure entries, whose fields CONTRIBUTING.md defines, are listed in `sessions.js` in the section's order.
 * Each CDF query's rows name their model in `series`; every model has the colour every chart gives it, and a model
 * past the eighth, whose colour is the Other grey, is not drawn. Each row of the speed-up query is one part of the
 * machine time, every row holding the same `rows`, the sessions it rests on.
 */

import { AXIS_STYLE, cdfPoints, chartFrame, colourScale, drawCdf, GRID_STYLE, TIP_STYLE } from "../shared/charts.js";
import { durationTicks, extent, fewerOnNarrow, tickCountFor } from "../axes/ticks.js";
import { formatCount, formatDurationTick, formatMultiple, formatSeconds } from "../shared/format.js";
import { slottedColours, TIME_PART_COLOURS } from "../theme/colours.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";

// The parts of the machine time, by their name in the speed-up query, top down, with the name each bar is drawn under.
const SPEEDUP_PARTS = Object.freeze({ prefill: "Prefill", decode: "Decode", tool: "Tools" });

// Each part's bar in the paper's colour of that part of a session's time, as the session time figure draws it.
const SPEEDUP_COLOURS = new Map([
  ["prefill", TIME_PART_COLOURS.prefill],
  ["decode", TIME_PART_COLOURS.decode],
  ["tool", TIME_PART_COLOURS.tool],
]);

/** The speed-up axis runs this far past the largest bar's gain over 1×, leaving room for its label, as the paper's. */
export const SPEEDUP_AXIS_HEADROOM = 1.26;
const NO_SPEEDUP = 1; // every bar starts at 1×, the sessions as they are
const SPEEDUP_DECIMALS = 2; // a bar's label: 1.38×
const SPEEDUP_TICK_DECIMALS = 1; // the axis's ticks: 1.1×
const SPEEDUP_TICKS = 5; // about this many ticks on the speed-up axis
const PART_LABEL_MARGIN = 92; // pixels left of the bars; room for the longest label, "Prefill 2×"
const BARS_MARGIN_TOP = 8; // pixels above the bars, which have no axis title above them
const BAR_LABEL_GAP = 4; // pixels between a bar's end and its label

/** The TTFT figure: the CDF of the time to first token per model. */
export const TTFT_CDF_BY_MODEL = Object.freeze({
  name: "ttft_cdf_by_model",
  title: "Time to first token by model",
  definition: "CDF of the time to first token per model over requests whose TTFT is trusted (positive and under 95% of the latency), where the five models with most requests from the paper's harnesses that are among the eight with most requests over every week are drawn and the paper draws two fixed models, each with its decode and queueing time.",
  caption: "Time to first token of each request, for the five busiest models.",
  drawsLines: true,
  query: "figures/ttft_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: drawnModelRows,
  legend: modelCdfLegend,
  draw: drawModelCdf,
});

/** The decode time figure: the CDF of latency minus TTFT per model, for the models and requests of the TTFT figure. */
export const DECODE_CDF_BY_MODEL = Object.freeze({
  name: "decode_cdf_by_model",
  title: "Decode time by model",
  definition: "CDF of the decode time (the latency minus the time to first token) per model over requests whose TTFT is trusted, where the five models with most requests from the paper's harnesses that are among the eight with most requests over every week are drawn, the paper draws two fixed models and the paper's queueing estimate is not drawn.",
  caption: "Latency minus time to first token, for the same five models.",
  drawsLines: true,
  query: "figures/decode_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: drawnModelRows,
  legend: modelCdfLegend,
  draw: drawModelCdf,
});

/** The speed-up figure: the sessions' machine time over the same with prefill, decode or tool time alone halved. */
export const SPEEDUP_IF_TWICE_AS_FAST = Object.freeze({
  name: "speedup_if_twice_as_fast",
  title: "Speed-up if twice as fast",
  definition: "The machine time of the top-level sessions (prefill, decode and tool time, a person's waits left out) over the same with prefill, decode or tool time alone halved, where a request's prefill is its time to first token and its decode the rest of its latency when its TTFT is trusted, the latency of a request without a trusted TTFT is shared out by its session's prefill ratio (else its harness's, else the one over all sessions), and a tool wait counts for at most 15 minutes.",
  caption: "How much faster sessions' machine time gets if one part alone ran twice as fast.",
  query: "figures/speedup_if_twice_as_fast",
  binColumn: null,
  seriesOverSameRows: true,
  draw: drawSpeedups,
});

/**
 * The bars of the speed-up figure: one `{ part, label, speedup, text }` per part of the rows, top down, `label` naming
 * the part run twice as fast ("Tools 2×") and `text` the speed-up as its bar is labelled ("1.38×").
 */
export function speedupBars(rows) {
  const speedups = new Map(rows.map((row) => [row.part, row.speedup]));
  const bars = [];
  for (const [part, name] of Object.entries(SPEEDUP_PARTS)) {
    if (speedups.has(part)) {
      const speedup = speedups.get(part);
      bars.push({ part, label: `${name} 2×`, speedup, text: formatMultiple(speedup, SPEEDUP_DECIMALS) });
    }
  }
  return bars;
}

/** The end of the speed-up axis: past the largest of `bars`' speed-ups by `SPEEDUP_AXIS_HEADROOM` of its gain. */
export function speedupAxisEnd(bars) {
  const largest = Math.max(NO_SPEEDUP, ...bars.map((bar) => bar.speedup));
  return NO_SPEEDUP + (largest - NO_SPEEDUP) * SPEEDUP_AXIS_HEADROOM;
}

/**
 * A per-model CDF's legend: the models of the rows among the eight with most requests over every week, in the model
 * order and colours every chart shares.
 */
export function modelCdfLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, slottedColours(colours.models));
}

/** The per-model CDF rows a figure draws: those of a model among the eight with most requests over every week. */
export function drawnModelRows(rows, colours) {
  const drawnModels = slottedColours(colours.models);
  return rows.filter((row) => drawnModels.has(row.series));
}

/** Draw one CDF per model of the rows, in seconds on a log axis of durations, each model in its legend's colour. */
async function drawModelCdf(rows, body, colours) {
  const series = cdfSeries(rows, [...colours.series.keys()]);
  const seconds = cdfPoints(series).map((point) => point.x);
  const ticks = durationTicks(extent(seconds));
  const xTicks = fewerOnNarrow(ticks, chartFrame(body).width);
  await drawCdf(body, series, {
    logX: true, xTicks, xTickFormat: formatDurationTick, format: formatSeconds,
    colours: colours.series,
  });
}

/** Draw one horizontal bar per part from 1× to its speed-up, labelled with it at its end. */
async function drawSpeedups(rows, body) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const bars = speedupBars(rows);
  const sessions = rows.length > 0 ? rows[0].rows : 0;
  const frame = chartFrame(body);
  const ticks = tickCountFor(frame.width, SPEEDUP_TICKS);
  const chart = Plot.plot({
    ...frame,
    marginTop: BARS_MARGIN_TOP,
    marginLeft: PART_LABEL_MARGIN,
    x: { domain: [NO_SPEEDUP, speedupAxisEnd(bars)] },
    y: { domain: bars.map((bar) => bar.label) },
    color: colourScale(SPEEDUP_COLOURS, bars.map((bar) => bar.part)),
    marks: [
      Plot.gridX({ ...GRID_STYLE, ticks }),
      Plot.axisX({ ...AXIS_STYLE, ticks, tickFormat: speedupTick, label: null }),
      Plot.axisY({ ...AXIS_STYLE, tickSize: 0, label: null }),
      Plot.barX(bars, {
        x1: NO_SPEEDUP,
        x2: "speedup",
        y: "label",
        fill: "part",
        title: (bar) => speedupTipText(bar, sessions),
        tip: TIP_STYLE,
      }),
      Plot.text(bars, { x: "speedup", y: "label", text: "text", textAnchor: "start", dx: BAR_LABEL_GAP }),
    ],
  });
  body.replaceChildren(chart);
}

function speedupTick(speedup) {
  return formatMultiple(speedup, SPEEDUP_TICK_DECIMALS);
}

function speedupTipText(bar, sessions) {
  return `${SPEEDUP_PARTS[bar.part]} twice as fast\nmachine time ${bar.text} faster\n${formatCount(sessions)} sessions`;
}
