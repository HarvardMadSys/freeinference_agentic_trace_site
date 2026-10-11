/**
 * The Sessions figures of a request's latency per model: the CDFs of its time to first token and of its decode time,
 * each for the five models with most requests in the selection that are among the eight with most requests over every
 * week, over requests whose TTFT is trusted.
 *
 * Their figure entries, whose fields CONTRIBUTING.md defines, are listed in `sessions.js` in the section's order.
 * Each query's rows name their model in `series`; every model has the colour every chart gives it, and a model past
 * the eighth, whose colour is the Other grey, is not drawn.
 */

import { drawCdf } from "../shared/charts.js";
import { formatSeconds } from "../shared/format.js";
import { slottedColours } from "../theme/colours.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";

/** The TTFT figure: the CDF of the time to first token per model. */
export const TTFT_CDF_BY_MODEL = Object.freeze({
  name: "ttft_cdf_by_model",
  title: "Time to first token by model",
  definition: "CDF of the time to first token per model over requests whose TTFT is trusted (positive and under 95% of the latency), where the five models with most requests in the selection that are among the eight with most requests over every week are drawn and the paper draws two fixed models, each with its decode and queueing time.",
  query: "figures/ttft_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: drawnModelRows,
  legend: modelCdfLegend,
  draw: drawTtftByModel,
});

/** The decode time figure: the CDF of latency minus TTFT per model, for the models and requests of the TTFT figure. */
export const DECODE_CDF_BY_MODEL = Object.freeze({
  name: "decode_cdf_by_model",
  title: "Decode time by model",
  definition: "CDF of the decode time (the latency minus the time to first token) per model over requests whose TTFT is trusted, where the five models with most requests in the selection that are among the eight with most requests over every week are drawn, the paper draws two fixed models and the paper's queueing estimate is not drawn.",
  query: "figures/decode_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  drawnRows: drawnModelRows,
  legend: modelCdfLegend,
  draw: drawDecodeByModel,
});

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

/** Draw the TTFT CDFs, in seconds on a log axis. */
async function drawTtftByModel(rows, body, colours) {
  await drawModelCdf(rows, body, colours, "Seconds to first token");
}

/** Draw the decode time CDFs, in seconds on a log axis. */
async function drawDecodeByModel(rows, body, colours) {
  await drawModelCdf(rows, body, colours, "Seconds of decode");
}

/** Draw one CDF per model of the rows, in seconds on a log axis labelled `xLabel`, each model in its legend's colour. */
async function drawModelCdf(rows, body, colours, xLabel) {
  const series = cdfSeries(rows, [...colours.series.keys()]);
  await drawCdf(body, series, { xLabel, logX: true, format: formatSeconds, colours: colours.series });
}
