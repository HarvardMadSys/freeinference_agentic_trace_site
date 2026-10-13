/**
 * The Latency section of the Explore page's figures: per model, the CDFs of a request's time to first token and of its
 * decode time, over requests whose TTFT is trusted; how a session's time splits between its parts, drawn in
 * `sessions_ranked.js`; and the speed-up of the sessions' machine time if one of its parts alone ran twice as fast.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. The CDFs are drawn by one call to the CDF
 * kind (`charts/cdf.js`); the speed-up, which no kind fits, has a plain draw function. Each CDF query's rows name
 * their model in `series`, one of the five models with most requests in the answer; every model has the colour every
 * chart gives it, and a model outside the eight with most requests over every week and every harness, whose colour
 * is the Other grey, is not drawn. Each row of the speed-up query is one part of the machine time, every row holding
 * the same `rows`, the sessions it rests on.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE } from "../shared/charts.js";
import { cdfLegend, drawCdf } from "../charts/cdf.js";
import { durationTicks, everyOther, extent, tickCountFor } from "../axes/ticks.js";
import { formatCount, formatDurationTick, formatMultiple, formatSeconds } from "../shared/format.js";
import { slottedColours, TIME_PART_COLOUR_MAP, TIME_PART_NAMES } from "../theme/colours.js";
import { rowsWithSeriesColour } from "../shared/series.js";
import { SESSION_TIME_BY_PART } from "./sessions_ranked.js";

// The parts of the machine time, by their name in the speed-up query, top down, with the name each bar is drawn under.
const SPEEDUP_PARTS = Object.freeze({
  prefill: TIME_PART_NAMES.prefill, decode: TIME_PART_NAMES.decode, tool: TIME_PART_NAMES.tool,
});

/** The speed-up axis runs this far past the largest bar's gain over 1×, leaving room for its label, as the paper's. */
export const SPEEDUP_AXIS_HEADROOM = 1.26;
const NO_SPEEDUP = 1; // every bar starts at 1×, the sessions as they are
const SPEEDUP_DECIMALS = 2; // a bar's label: 1.38×
const SPEEDUP_TICK_DECIMALS = 1; // the axis's ticks: 1.1×
const SPEEDUP_TICKS = 5; // about this many ticks on the speed-up axis
const PART_LABEL_MARGIN = 104; // pixels left of the bars; room for the longest label, "Tool wait 2×"
const BARS_MARGIN_TOP = 8; // pixels above the bars, which have no axis title above them
const BAR_LABEL_GAP = 4; // pixels between a bar's end and its label

/** The TTFT figure: the CDF of the time to first token per model. */
export const TTFT_CDF_BY_MODEL = Object.freeze({
  name: "ttft_cdf_by_model",
  title: "Time to first token by model",
  insight: "Most of the first-token wait isn't spent processing input.",
  definition: "Each line shows the percentage of requests that receive their first output token within the time shown, for the five busiest models. This time includes input processing and waiting at the server. Measurements count only when positive and below 95% of total request time.",
  caption: "On the two externally routed models, median time to first token is roughly four seconds, while estimated prefill typically takes less than 0.1 seconds. Serving overhead accounts for most of the delay.",
  drawsLines: true,
  query: "figures/ttft_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: (rows, colours) => rowsWithSeriesColour(rows, "series", colours.models),
  legend: modelCdfLegend,
  draw: drawModelCdf,
});

/** The decode time figure: the CDF of latency minus TTFT per model, for the models and requests of the TTFT figure. */
export const DECODE_CDF_BY_MODEL = Object.freeze({
  name: "decode_cdf_by_model",
  title: "Decode time by model",
  insight: "Agents generate short responses, leaving relatively little decoding work.",
  definition: "Each line shows the percentage of requests that finish generating output within the time shown, for the five busiest models. Generation time is total request time minus time to first token. Only requests with reliable first-token measurements are included.",
  caption: "Requests generate only a few hundred output tokens at the median, keeping typical decode latency around one to three seconds on the externally routed models.",
  drawsLines: true,
  query: "figures/decode_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: (rows, colours) => rowsWithSeriesColour(rows, "series", colours.models),
  legend: modelCdfLegend,
  draw: drawModelCdf,
});

/** The speed-up figure: the sessions' machine time over the same with prefill, decode or tool time alone halved. */
export const SPEEDUP_IF_TWICE_AS_FAST = Object.freeze({
  name: "speedup_if_twice_as_fast",
  title: "Speedup by component",
  insight: "Faster tools improve agent performance more than faster inference.",
  definition: "Estimated speedup if input processing (prefill), output generation (decode), or tool execution takes half as long. Each bar changes one component and uses total active time across main sessions. User waits are excluded, each tool wait is capped at 15 minutes, and prefill time uses reliable time-to-first-token measurements.",
  caption: "In a simulated speedup analysis excluding user idle time, doubling tool throughput yields a 1.38× speedup, compared with 1.09× for prefill and 1.16× for decoding.",
  query: "figures/speedup_if_twice_as_fast",
  binColumn: null,
  seriesOverSameRows: true,
  draw: drawSpeedups,
});

/** The Latency topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Tools take the most active time; waiting for users accounts for half of total session time.";

/** The figures of the Latency section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  TTFT_CDF_BY_MODEL,
  DECODE_CDF_BY_MODEL,
  SESSION_TIME_BY_PART,
  SPEEDUP_IF_TWICE_AS_FAST,
]);

/**
 * The bars of the speed-up figure: one `{ part, label, speedup, text }` per part of the rows, top down, `label` naming
 * the part run twice as fast ("Tool wait 2×") and `text` the speed-up as its bar is labelled ("1.38×").
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
export function modelCdfLegend(rows, colours) {
  return cdfLegend(rows, slottedColours(colours.models));
}

/** Draw a model CDF: one line per model, in seconds on a log axis ticked at the durations within its rows' range. */
function drawModelCdf(rows, body, colours, hidden) {
  const ticks = durationTicksOf(rows);
  return drawCdf(rows, body, colours, {
    logScale: true,
    xTicks: ticks,
    narrowXTicks: everyOther(ticks),
    xTickFormat: formatDurationTick,
    xLabel: null,
    yLabel: "Share of requests",
    valueFormat: formatSeconds,
  }, hidden);
}

/** A model CDF's x ticks: the durations people count time in (`durationTicks`) within the rows' range of seconds. */
export function durationTicksOf(rows) {
  return durationTicks(extent(rows.map((row) => row.x)));
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
    // Each part's bar in the paper's colour of that part of a session's time, as the session time figure draws it.
    color: colourScale(TIME_PART_COLOUR_MAP, bars.map((bar) => bar.part)),
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
        tip: true,
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
