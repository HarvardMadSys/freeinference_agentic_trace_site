/**
 * The Sessions figure of a request's time after its first token: the CDF of decode time per model.
 *
 * Its figure entry, whose fields CONTRIBUTING.md defines, is listed in `sessions.js` in the section's order.
 */

import { drawCdf } from "../shared/charts.js";
import { formatSeconds } from "../shared/format.js";
import { cdfSeries, seriesLegend } from "./figure_rows.js";

/** The decode time figure: the CDF of latency minus TTFT per model, for the models and requests of the TTFT figure. */
export const DECODE_CDF_BY_MODEL = Object.freeze({
  name: "decode_cdf_by_model",
  title: "Decode time by model",
  definition: "CDF of the decode time (the latency minus the time to first token) of the five models with most requests in the selection, over requests whose TTFT is trusted, as in the TTFT figure; the paper's queueing estimate is not drawn.",
  query: "figures/decode_cdf_by_model",
  binColumn: "series",
  seriesColumn: "series",
  legend: decodeLegend,
  draw: drawDecodeByModel,
});

/** The decode CDF's legend: its models, in the model order and colours every chart shares. */
function decodeLegend(rows, colours) {
  return seriesLegend(rows, "series", colours.models);
}

/** Draw the decode time CDFs of the selection's largest models, in seconds on a log axis, each model in its colour. */
async function drawDecodeByModel(rows, body, colours) {
  const series = cdfSeries(rows, [...colours.series.keys()]);
  await drawCdf(body, series, { xLabel: "Seconds of decode", logX: true, format: formatSeconds, colours: colours.series });
}
