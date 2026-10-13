/**
 * The Overview's two donuts, over every harness, the benchmark's included, as the stats strip counts: the model mix,
 * each model's share of the requests (`explore/model_mix`), and the harness mix, each harness's share of the sessions
 * (`explore/sessions_per_week_by_harness`, which the page asks for once and the sessions trend draws too, summed over
 * the weeks).
 * A donut names the series that hold the eight colours of its colour order (`setup/model_order`,
 * `setup/harness_order`), in those colours, as the trends colour them, and folds the rest into "Other"; its slices run
 * largest first, "Other" last. Its legend hides and shows a slice (`explore/legend.js`); once one is hidden, the shares
 * and the total in the centre are of the slices shown, and the centre says so.
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`.
 */

import { chartName, columnTotal, renderFigure, showError, showLoading } from "../shared/charts.js";
import { formatCompactCount, formatCount, formatQuantity, formatShare } from "../shared/format.js";
import { barColours, HARNESS_FIRST_SLOT, OTHER_NAME, SERIES_SLOTS } from "../theme/colours.js";
import { drawWithLegend } from "../explore/legend.js";
import { harnessText } from "../explore/sessions_table_state.js";
import { donutArcs } from "./arcs.js";

// The donut's size in the SVG's own units, which the page scales to the card: the outer and inner radii.
const OUTER_RADIUS = 100;
const INNER_RADIUS = 62;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** Fill `container` with the two donut cards, each loading: `{ models, harnesses }`. */
export function layoutMixes(container) {
  const models = document.createElement("article");
  const harnesses = document.createElement("article");
  for (const place of [models, harnesses]) {
    place.className = "card donut-card";
    showLoading(place);
  }
  container.replaceChildren(models, harnesses);
  return { models, harnesses };
}

/** Lay out the donuts in `container` and draw them; a donut whose query fails shows its error in its card. */
export async function runMixes(container, context) {
  const places = layoutMixes(container);
  await Promise.all([
    drawModelMix(places.models, context).catch((error) => showError(places.models, error)),
    drawHarnessMix(places.harnesses, context).catch((error) => showError(places.harnesses, error)),
  ]);
}

/**
 * The donut's slices `[{ name, count }]` of `rows`: `row[countColumn]` summed by `row[nameColumn]`, a name among the
 * first eight of `order` keeping its own slice and every other name summed into "Other". The named slices come largest
 * first, "Other" last; a name with no rows has no slice.
 */
export function donutSlices(rows, nameColumn, countColumn, order) {
  const named = order.slice(0, SERIES_SLOTS.length);
  const counts = new Map();
  for (const row of rows) {
    const name = named.includes(row[nameColumn]) ? row[nameColumn] : OTHER_NAME;
    counts.set(name, (counts.get(name) ?? 0) + row[countColumn]);
  }
  const slices = [];
  for (const name of named) {
    if (counts.has(name)) {
      slices.push({ name, count: counts.get(name) });
    }
  }
  slices.sort((first, second) => second.count - first.count);
  if (counts.has(OTHER_NAME)) {
    slices.push({ name: OTHER_NAME, count: counts.get(OTHER_NAME) });
  }
  return slices;
}

async function drawModelMix(place, context) {
  const orderRows = await context.orders.models;
  const rows = await context.database.runQuery("explore/model_mix");
  const order = orderRows.map((row) => row.model);
  await drawMix(place, donutSlices(rows, "model", "requests", order), barColours(order), {
    title: "Model mix",
    caption: "Each model's share of the requests.",
    definition: "Requests of the top-level sessions of every harness over every week, the benchmark replay's "
      + "included, by the model they asked for. The eight models with most requests are named, as the trends name "
      + "them; the rest are Other.",
    singular: "request",
    plural: "requests",
    formatTotal: formatCompactCount, // a million requests is too wide for the centre written in full
    nameText: modelText,
  });
}

async function drawHarnessMix(place, context) {
  const orderRows = await context.orders.harnesses;
  const rows = await context.sessionsPerWeekByHarness; // the page asks for them once, for this and the sessions trend
  const order = orderRows.map((row) => row.harness);
  const colours = barColours(order, HARNESS_FIRST_SLOT);
  await drawMix(place, donutSlices(rows, "harness", "sessions", order), colours, {
    title: "Harness mix",
    caption: "Each harness's share of the sessions.",
    definition: "Top-level sessions of every harness over every week, the benchmark replay's included, by harness. "
      + "The eight harnesses with most sessions are named, as the trends name them; the rest are Other.",
    singular: "session",
    plural: "sessions",
    formatTotal: formatCount,
    nameText: harnessText, // the benchmark replay's harness as the Session Explorer names it, "swe-bench"
  });
}

// Draw a donut card into `place`: its title, caption and definition from `text`, the legend, and the donut of the
// shown slices.
async function drawMix(place, slices, colours, text) {
  const body = renderFigure(place, {
    title: text.title,
    caption: text.caption,
    definition: text.definition,
    rows: formatQuantity(columnTotal(slices, "count"), text.singular, text.plural),
  });
  // The legend lists the slices in the donut's order, largest first, each with its share of every slice.
  const legend = { series: legendSeries(slices, text.nameText), colours };
  const drawShown = (hidden) => drawDonut(body, slices.filter((slice) => !hidden.has(slice.name)), colours, {
    ...text, unit: centreUnit(text.plural, hidden.size),
  });
  await drawWithLegend(body, legend, drawShown);
}

/**
 * The legend's entries `[{ name, label }]` of `slices`, each labelled with its name as `nameText` writes it and its
 * share of them: "glm-5.3-flash 44.0%".
 */
export function legendSeries(slices, nameText) {
  const total = columnTotal(slices, "count");
  const entries = [];
  for (const slice of slices) {
    entries.push({ name: slice.name, label: `${nameText(slice.name)} ${formatShare(slice.count / total)}` });
  }
  return entries;
}

/** A model as the donut names it: as the release does. */
function modelText(model) {
  return model;
}

/** The line under the donut's total: what it counts, "requests", or "shown requests" while `hiddenCount` are hidden. */
export function centreUnit(plural, hiddenCount) {
  return hiddenCount === 0 ? plural : `shown ${plural}`;
}

/**
 * Draw into `body` the donut of `slices` (`[{ name, count }]`), each in its colour of `colours`, with a tooltip of its
 * name, share and count, and the slices' total in the centre, written by `text.formatTotal`, over `text.unit`.
 */
function drawDonut(body, slices, colours, text) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", `${-OUTER_RADIUS} ${-OUTER_RADIUS} ${2 * OUTER_RADIUS} ${2 * OUTER_RADIUS}`);
  svg.setAttribute("class", "donut");
  svg.setAttribute("role", "img");
  let total = 0;
  for (const arc of donutArcs(slices, OUTER_RADIUS, INNER_RADIUS)) {
    svg.append(slicePath(arc, colours, text));
    total += arc.count;
  }
  // Named by its card's title and caption, as every chart is; the total in the centre is read as its text.
  svg.setAttribute("aria-label", chartName(body));
  const value = svgElement("text", { y: "-0.15em", class: "donut-total" });
  value.textContent = text.formatTotal(total);
  const unit = svgElement("text", { y: "1.35em", class: "donut-unit" });
  unit.textContent = text.unit;
  svg.append(value, unit);
  body.replaceChildren(svg);
}

// A slice's ring segment, with its tooltip: its name, its share of the slices shown, and its count.
function slicePath(arc, colours, text) {
  const path = svgElement("path", { d: arc.path, fill: colours.get(arc.name), class: "donut-slice" });
  const tooltip = svgElement("title", {});
  tooltip.textContent = `${text.nameText(arc.name)}: ${formatShare(arc.share)} of ${text.unit} (${formatCount(arc.count)})`;
  path.append(tooltip);
  return path;
}

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}
