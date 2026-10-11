/**
 * The Sessions figures of a request's latency per model: the CDFs of its time to first token and of its decode time,
 * each for the five models with most requests in the selection, over requests whose TTFT is trusted.
 *
 * Their figure entries, whose fields CONTRIBUTING.md defines, are listed in `sessions.js` in the section's order.
 * Each query's rows name their model in `series`; every model has the colour every chart gives it.
 */

import { drawCdf } from "../shared/charts.js";
import { formatSeconds } from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";

/** The TTFT figure: the CDF of the time to first token per model. */
export const TTFT_CDF_BY_MODEL = Object.freeze({
  name: "ttft_cdf_by_model",
  title: "Time to first token by model",
  definition: "CDF of the time to first token of the five models with most requests in the selection, over requests whose TTFT is trusted (positive and under 95% of the latency), where the paper draws two fixed models, each with its decode and queueing time.",
  query: "figures/ttft_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  legend: modelCdfLegend,
  draw: drawTtftByModel,
});

/** The decode time figure: the CDF of latency minus TTFT per model, for the models and requests of the TTFT figure. */
export const DECODE_CDF_BY_MODEL = Object.freeze({
  name: "decode_cdf_by_model",
  title: "Decode time by model",
  definition: "CDF of the decode time (the latency minus the time to first token) of the five models with most requests in the selection, over requests whose TTFT is trusted, where the paper draws two fixed models; the paper's queueing estimate is not drawn.",
  query: "figures/decode_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  legend: modelCdfLegend,
  draw: drawDecodeByModel,
});

/** A per-model CDF's legend: its models, in the model order and colours every chart shares. */
function modelCdfLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, colours.models);
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
