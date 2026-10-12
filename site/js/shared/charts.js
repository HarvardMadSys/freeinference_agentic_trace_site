/**
 * What every chart shares: its frame and ink, its log-axis ticks, folding series past the eighth into "Other", loading
 * and error states, the figure card, and the CDF and bar drawings. The colours a chart draws in come from `theme/colours.js`.
 * The drawing functions load Plot themselves; the rest is plain functions, tested with `node --test`.
 */

import { OTHER_NAME, SERIES_SLOTS } from "../theme/colours.js";
import { formatCount, formatPercent, formatShare } from "./format.js";
import { axisWithTicks, extent, logAxisTicks, TICK_COUNT } from "../axes/ticks.js";

/** A bin, category or model with fewer rows than this is not drawn: too few rows to show a shape. */
export const MIN_ROWS_PER_BIN = 50;

// Joins a bar's x value and series name into one key when summing folded rows.
const KEY_SEPARATOR = "\u0000";

const CHART_HEIGHT = 240; // every chart has the same height, so a grid of figures lines up
const FALLBACK_WIDTH = 480; // the width drawn when the body has not been laid out yet
const CATEGORY_ROW_HEIGHT = 22; // pixels per category, so sixteen categories keep readable labels
const CATEGORY_MARGIN_LEFT = 116; // pixels; room for the longest category name, "*Interpreter"
const CATEGORY_MARGIN_TOP = 8; // pixels above the first row: the rows have no title above them
const CATEGORY_MARGINS_Y = 56; // pixels above and below the rows: the top margin and the x axis
/** The width of every chart's lines, in pixels: thin lines. */
export const LINE_WIDTH = 2;
const BAR_INSET = 1; // pixels taken off each side of a bar: a 2px gap between neighbouring bars and segments
/** The dash and gap lengths of every dashed line, in pixels: a CDF's median, a percentile, a reference line. */
export const DASH = "4 3";
const MEDIAN_SHARE = 0.5; // the share of rows at which a CDF crosses its median
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
/** The options of every chart's tooltip: Plot's white box would be unreadable in dark mode, so it takes the surface colour. */
export const TIP_STYLE = Object.freeze({ fill: "var(--color-surface)" });

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

/** A copy of `rows` with `row[key]` replaced by "Other" where it is not among the first eight distinct `names`. */
export function foldToOther(rows, key, names) {
  const named = distinct(names).slice(0, SERIES_SLOTS.length);
  return rows.map((row) => (named.includes(row[key]) ? row : { ...row, [key]: OTHER_NAME }));
}

/** The rows with every row sharing `row[x]` and `row[fill]` summed into one on `row[y]`, in order of first appearance. */
export function sumFolded(rows, { x, y, fill }) {
  const sums = new Map();
  for (const row of rows) {
    // Two rows belong together when both their bar and their series match; the separator cannot occur in either.
    const barAndSeries = `${row[x]}${KEY_SEPARATOR}${row[fill]}`;
    const sum = sums.get(barAndSeries);
    if (sum === undefined) {
      sums.set(barAndSeries, { ...row });
    } else {
      sum[y] += row[y];
    }
  }
  return [...sums.values()];
}

/** `{ rows, hidden }`: the rows whose `row[countKey]` is at least `MIN_ROWS_PER_BIN`, and how many rows were dropped. */
export function dropThinBins(rows, countKey) {
  const kept = rows.filter((row) => row[countKey] >= MIN_ROWS_PER_BIN);
  return { rows: kept, hidden: rows.length - kept.length };
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
 * Fill `container` with a figure card, in this order: its title, its caption (one short line), an empty place for its
 * legend, an empty body to draw into, and a Definition control that opens on its full definition and the line of rows
 * it rests on, `rows`, which may also be written later into the card's `.figure-rows`. Return the body.
 */
export function renderFigure(container, { title, caption, definition, rows = "" }) {
  const figure = document.createElement("div");
  figure.className = "figure";
  figure.innerHTML = `
    <h3 class="figure-title"></h3>
    <p class="figure-caption"></p>
    <div class="figure-legend legend"></div>
    <div class="figure-body"></div>
    <details class="figure-definition">
      <summary>Definition</summary>
      <p class="figure-definition-text"></p>
      <p class="figure-rows"></p>
    </details>`;
  figure.querySelector(".figure-title").textContent = title;
  figure.querySelector(".figure-caption").textContent = caption;
  figure.querySelector(".figure-definition-text").textContent = definition;
  figure.querySelector(".figure-rows").textContent = rows;
  container.replaceChildren(figure);
  return figure.querySelector(".figure-body");
}

/** The place above a figure's body, as `renderFigure` lays it out, where its legend goes. */
export function legendPlace(body) {
  return body.closest(".figure").querySelector(".figure-legend");
}

/**
 * Draw into `body` one line per series of `series`, `[{ name, label, points: [{ x, share }] }]`, with share running
 * 0 to 1, each in its colour from `colours` (a map from series name to colour, as `assignColours` gives); the tooltip
 * names a series by its label. `format` writes an x value in the tooltip, `xTickFormat` (if given) on the axis;
 * `xDomain`, when given, is the x axis's `[low, high]`, the lines cut at its ends; `xTicks`, when given, are the x
 * axis's ticks, else a log axis ticks its powers of ten (`logAxisTicks`); `xLabel` and `yLabel` title the axes, none
 * when null.
 */
export async function drawCdf(body, series, options) {
  const { xLabel = null, yLabel = "Share", logX = false, format = String, xTickFormat, colours, xDomain } = options;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const points = cdfPoints(series);
  const names = series.map((one) => one.name);
  const xTicks = options.xTicks ?? (logX ? logAxisTicks(xDomain ?? extent(points.map((point) => point.x))) : undefined);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: logX ? "log" : "linear", domain: xDomain, inset: X_INSET },
    y: { domain: [0, 1] },
    clip: xDomain !== undefined,
    color: colourScale(colours, names),
    marks: [
      xTicks === undefined ? Plot.gridX(GRID_STYLE) : Plot.gridX(xTicks, GRID_STYLE),
      Plot.gridY(GRID_STYLE),
      Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, strokeDasharray: DASH }),
      axisWithTicks(Plot.axisX, xTicks, { ...AXIS_STYLE, label: xLabel, tickFormat: xTickFormat }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: yLabel }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH }),
      Plot.tip(points, Plot.pointerX({ ...TIP_STYLE, x: "x", y: "share", title: (point) => cdfTipText(point, format) })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * Draw into `body` one bar per row of `rows`: `row[x]` along the axis, `row[y]` its height, coloured by `row[fill]`
 * in its colour from `colours`, a Map from each fill value (and "Other") to its colour, in the order the series stack.
 * Series past the eighth of `order` (a fixed order of fill values, largest first) or of the rows' order fold into
 * "Other", summed into one bar per x. Bars stack when `stacked`; `format` writes a y value in the tooltip and, unless
 * `yTickFormat` is given, on the axis; `yLabel` names a y value in the tooltip and, unless `yAxisLabel` is given (null
 * for none), titles the axis; `xTickFormat`, when given, writes the x axis's ticks; `xDomain`, when given, lists every x value in order,
 * so one with no rows keeps its place; `fillOpacity`, when given, is each bar's opacity, a number or a function of its
 * row. Returns the chart's element.
 */
export async function drawBars(body, rows, options) {
  const { x, y, fill, order, colours, stacked = false, xLabel, yLabel, format = formatCount } = options;
  const { xTickFormat, xDomain, fillOpacity, yTickFormat = format, yAxisLabel = yLabel } = options;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const names = distinct(order ?? rows.map((row) => row[fill]));
  const foldedRows = sumFolded(foldToOther(rows, fill, names), { x, y, fill });
  const shown = [...colours.keys()].filter((name) => foldedRows.some((row) => row[fill] === name));
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "band", domain: xDomain ?? distinct(foldedRows.map((row) => row[x])) },
    color: colourScale(colours, shown),
    marks: [
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      Plot.axisX({ ...AXIS_STYLE, tickFormat: xTickFormat, label: xLabel }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: yTickFormat, label: yAxisLabel }),
      Plot.barY(foldedRows, {
        x,
        ...barHeight(y, stacked),
        fill,
        fillOpacity,
        order: shown, // the stacking order, bottom up; unused when the bars do not stack
        inset: BAR_INSET,
        title: (row) => barTipText(row, { x, y, fill, yLabel, format }),
        tip: TIP_STYLE,
      }),
      Plot.ruleY([0], AXIS_STYLE),
    ],
  });
  body.replaceChildren(chart);
  return chart;
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

// A stacked bar starts where the bars below it end; an unstacked bar starts at zero.
function barHeight(y, stacked) {
  if (stacked) {
    return { y };
  }
  return { y2: y };
}

/** The points of CDF series `[{ name, label, points: [{ x, share }] }]` as one list: `[{ name, label, x, share }]`. */
export function cdfPoints(series) {
  const points = [];
  for (const one of series) {
    for (const point of one.points) {
      points.push({ name: one.name, label: one.label, x: point.x, share: point.share });
    }
  }
  return points;
}

function cdfTipText(point, format) {
  return `${point.label}\n${format(point.x)}\n${formatShare(point.share)} at or below`;
}

function barTipText(row, { x, y, fill, yLabel, format }) {
  return `${row[fill]}\n${row[x]}\n${yLabel}: ${format(row[y])}`;
}
