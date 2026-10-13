/**
 * What every chart shares: its frame and ink, loading and error states, and the figure card and its places;
 * the chart kinds are in `js/charts/`. The colours a chart draws in come from `theme/colours.js`. Its functions
 * that need no page are tested with `node --test`.
 */

/** Every chart's height, so a grid of figures lines up. */
export const CHART_HEIGHT = 240;
/** The height of a chart beside a tall neighbour, a long table or a chart of many categories, so its row has no gap. */
export const TALL_CHART_HEIGHT = 400;
const FALLBACK_WIDTH = 480; // the width drawn when the body has not been laid out yet
const CATEGORY_ROW_HEIGHT = 22; // pixels per category, so sixteen categories keep readable labels
const CATEGORY_MARGIN_LEFT = 116; // pixels; room for the longest category name, "*Interpreter"
const CATEGORY_MARGIN_TOP = 8; // pixels above the first row: the rows have no title above them
const CATEGORY_MARGINS_Y = 56; // pixels above and below the rows: the top margin and the x axis
/** The width of every chart's lines, in pixels: thin lines. */
export const LINE_WIDTH = 2;
/** Pixels taken off each side of a bar: a 2px gap between neighbouring bars and segments. */
export const BAR_INSET = 1;
/** The dash and gap lengths of every dashed line, in pixels: a CDF's median, a percentile, a reference line. */
export const DASH = "4 3";
/** Pixels between the y axis and an x axis's first value, so its label and the y axis's lowest keep a gap. */
export const X_INSET = 16;

// The Plot options every chart shares, so every chart has the same ink, in the page's own face: Plot's default face
// draws "*Search" with another asterisk than the page's text.
const PLOT_STYLE = Object.freeze({
  color: "var(--chart-label)", background: "transparent", fontFamily: "var(--font-sans)",
});
const PLOT_MARGINS = Object.freeze({ marginTop: 32, marginRight: 32, marginBottom: 48, marginLeft: 72 });
/** The options of every chart's grid lines. */
export const GRID_STYLE = Object.freeze({ stroke: "var(--chart-grid)", strokeOpacity: 1 });
/** The options of every chart's axes and reference rules: the axis ink, and an axis title with no arrow. */
export const AXIS_STYLE = Object.freeze({ stroke: "var(--chart-axis)", labelArrow: "none" });
/** A label written on a chart: in the label ink, on a halo of the card's colour so a line under it does not cross it. */
export const LINE_LABEL_STYLE = Object.freeze({
  fill: "var(--chart-label)", stroke: "var(--color-surface)", strokeWidth: 4, paintOrder: "stroke",
});

/** The Plot options every chart starts from: its margins, its height, the width of `body`, and its ink. */
export function chartFrame(body) {
  return { ...PLOT_MARGINS, width: chartWidth(body), height: CHART_HEIGHT, style: PLOT_STYLE };
}

/**
 * The frame of a chart with one row per tool category: `chartFrame`'s, as tall as `categoryCount` rows need and with
 * room on the left for the categories' names.
 */
export function categoryRowsFrame(body, categoryCount) {
  const height = categoryCount * CATEGORY_ROW_HEIGHT + CATEGORY_MARGINS_Y;
  return { ...chartFrame(body), height, marginTop: CATEGORY_MARGIN_TOP, marginLeft: CATEGORY_MARGIN_LEFT };
}

/** Replace `container`'s content with the loading state. */
export function showLoading(container) {
  const loading = document.createElement("p");
  loading.className = "loading";
  loading.textContent = "Loading";
  container.replaceChildren(loading);
}

/** Replace `container`'s content with a note reading `text`. */
export function showNote(container, text) {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = text;
  container.replaceChildren(note);
}

/** Replace `container`'s content with the error state holding `error`'s message, and log the error. */
export function showError(container, error) {
  console.error(error);
  const note = document.createElement("p");
  note.className = "note is-error";
  note.textContent = error.message;
  container.replaceChildren(note);
}

/**
 * Fill `container` with a figure card and return its body, the empty place to draw into. A card with an `insight`, one
 * sentence of what the chart means, shows its title, the insight, an empty place for its legend, the body and its
 * caption (evidence supporting the insight); a card without one shows its title, its caption, the legend's place and
 * the body. Both end in a Definition control that opens on the full definition and the line of rows it rests on,
 * `rows`, which may also be written later into the card's `.figure-rows`. The title is a heading of the tag `heading`,
 * an `h3` under a section's `h2` by default.
 */
export function renderFigure(container, { title, insight = null, caption, definition, rows = "", heading = "h3" }) {
  const figure = document.createElement("div");
  figure.className = "figure";
  const titleLine = textElement(heading, "figure-title", title);
  const captionLine = textElement("p", "figure-caption", caption);
  const legend = textElement("div", "figure-legend legend", "");
  const body = textElement("div", "figure-body", "");
  if (insight === null) {
    figure.append(titleLine, captionLine, legend, body);
  } else {
    figure.append(titleLine, textElement("p", "figure-insight", insight), legend, body, captionLine);
  }
  figure.append(figureDefinition(definition, rows));
  container.replaceChildren(figure);
  return body;
}

/**
 * A figure's Definition control: a closed `<details>` that opens on `definition` and, under it, `rows`, the line of
 * the rows it rests on (its element has the class `figure-rows`).
 */
export function figureDefinition(definition, rows = "") {
  const details = document.createElement("details");
  details.className = "figure-definition";
  details.innerHTML = `
    <summary>Definition</summary>
    <p class="figure-definition-text"></p>
    <p class="figure-rows"></p>`;
  details.querySelector(".figure-definition-text").textContent = definition;
  details.querySelector(".figure-rows").textContent = rows;
  return details;
}

/**
 * The accessible name of the chart in a figure's `body` (as `renderFigure` lays it out): its card's title and its
 * insight, or its caption where it has none, "Sessions per week: Top-level sessions each week, by harness."
 */
export function chartName(body) {
  const figure = body.closest(".figure");
  const point = figure.querySelector(".figure-insight") ?? figure.querySelector(".figure-caption");
  return `${figure.querySelector(".figure-title").textContent}: ${point.textContent}`;
}

/**
 * Name every chart drawn in a figure's `body` for a screen reader, as one image named by `chartName`; called after
 * each drawing, since a drawing replaces the chart. A body holding a note or a table has no chart to name.
 */
export function nameChart(body) {
  for (const chart of body.querySelectorAll("svg:not(svg svg)")) {
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", chartName(body));
  }
}

/** The place above a figure's body, as `renderFigure` lays it out, where its legend goes. */
export function legendPlace(body) {
  return body.closest(".figure").querySelector(".figure-legend");
}

/** The place behind a figure's Definition control, as `renderFigure` lays it out, where its line of rows goes. */
export function rowsPlace(body) {
  return body.closest(".figure").querySelector(".figure-rows");
}

/** The sum of `row[column]` over `rows`. */
export function columnTotal(rows, column) {
  let total = 0;
  for (const row of rows) {
    total += row[column];
  }
  return total;
}

/** The distinct values, in the order of their first appearance. */
export function distinct(values) {
  return [...new Set(values)];
}

function chartWidth(body) {
  return body.clientWidth || FALLBACK_WIDTH;
}

/**
 * Plot's colour scale for the `shown` names, each in its colour from the map `colours`. It draws no legend: a chart of
 * more than one series has the Explore page's legend of buttons, or the Session page's legend line, instead.
 */
export function colourScale(colours, shown) {
  return {
    type: "ordinal",
    domain: shown,
    range: shown.map((name) => colours.get(name)),
  };
}

// An element of `tagName` with the class `className` holding `text`.
function textElement(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}
