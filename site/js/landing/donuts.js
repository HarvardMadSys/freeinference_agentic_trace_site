/**
 * The Overview's two donuts, over every harness, the benchmark's included, as the stats strip counts: the model mix,
 * each model's share of the requests (`explore/model_mix`), and the harness mix, each harness's share of the sessions
 * (`explore/sessions_per_week_by_harness`, summed over the weeks).
 *
 * A donut names the series that hold the eight colours of its colour order (`setup/model_order`,
 * `setup/harness_order`), in those colours, as the trends colour them, and folds the rest into "Other"; the donut kind
 * (`charts/donut.js`) draws it. Its legend hides and shows a slice (`explore/legend.js`).
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`.
 */

import { columnTotal, renderFigure, showError, showLoading } from "../shared/charts.js";
import { readAnswer } from "../shared/answers.js";
import { formatCompactCount, formatCount, formatQuantity } from "../shared/format.js";
import { barColours, HARNESS_FIRST_SLOT } from "../theme/colours.js";
import { drawWithLegend } from "../explore/legend.js";
import { harnessText } from "../explore/sessions_table_state.js";
import { donutLegend, drawDonut } from "../charts/donut.js";

/** Lay out the donuts in `container` and draw them; a donut whose query fails shows its error in its card. */
export async function runMixes(container, context) {
  const places = layoutMixes(container);
  await Promise.all([
    drawModelMix(places.models, context).catch((error) => showError(places.models, error)),
    drawHarnessMix(places.harnesses, context).catch((error) => showError(places.harnesses, error)),
  ]);
}

/** Fill `container` with the two donut cards, each loading: `{ models, harnesses }`. */
function layoutMixes(container) {
  const models = document.createElement("article");
  const harnesses = document.createElement("article");
  for (const place of [models, harnesses]) {
    place.className = "card donut-card";
    showLoading(place);
  }
  container.replaceChildren(models, harnesses);
  return { models, harnesses };
}

async function drawModelMix(place, context) {
  const orderRows = await context.orders.models;
  const rows = await readAnswer("explore/model_mix");
  const body = renderFigure(place, {
    title: "Model mix",
    caption: "Each model's share of the requests.",
    definition: "Requests of the top-level sessions of every harness over every week, the benchmark replay's "
      + "included, by the model they asked for. The eight models with most requests are named, as the trends name "
      + "them; the rest are Other.",
    rows: formatQuantity(columnTotal(rows, "requests"), "request", "requests"),
  });
  const colours = barColours(orderRows.map((row) => row.model));
  const legend = donutLegend(rows, colours, { nameColumn: "model", countColumn: "requests" });
  await drawWithLegend(body, legend, (hidden) => drawDonut(rows, body, { series: colours }, {
    nameColumn: "model",
    countColumn: "requests",
    unit: "requests",
    totalFormat: formatCompactCount, // a million requests is too wide for the centre written in full
  }, hidden));
}

async function drawHarnessMix(place, context) {
  const orderRows = await context.orders.harnesses;
  const rows = await context.sessionsPerWeekByHarness; // the page asks for them once, for this and the sessions trend
  const body = renderFigure(place, {
    title: "Harness mix",
    caption: "Each harness's share of the sessions.",
    definition: "Top-level sessions of every harness over every week, the benchmark replay's included, by harness. "
      + "The eight harnesses with most sessions are named, as the trends name them; the rest are Other.",
    rows: formatQuantity(columnTotal(rows, "sessions"), "session", "sessions"),
  });
  const order = orderRows.map((row) => row.harness);
  const colours = barColours(order, HARNESS_FIRST_SLOT);
  // The benchmark replay's harness is named as the Session Explorer names it, "swe-bench".
  const labels = Object.fromEntries(order.map((harness) => [harness, harnessText(harness)]));
  const legend = donutLegend(rows, colours, { nameColumn: "harness", countColumn: "sessions", labels });
  await drawWithLegend(body, legend, (hidden) => drawDonut(rows, body, { series: colours }, {
    nameColumn: "harness",
    countColumn: "sessions",
    unit: "sessions",
    totalFormat: formatCount,
    labels,
  }, hidden));
}
