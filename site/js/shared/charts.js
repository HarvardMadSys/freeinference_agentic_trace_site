/**
 * What every chart shares: series colours, captions, loading and error states, the figure layout, and the CDF and bar drawings.
 *
 * Every colour is a CSS variable from `style.css`, so a chart follows the
 * page into dark mode with no JavaScript. Names get colours from one fixed
 * order, so the same model, category or policy has the same colour in every
 * chart. The drawing functions load Plot themselves; the rest is plain
 * functions, tested with `node --test`.
 */

import { formatCount, formatShare } from "./format.js";

/** The eight series colours, in order. A chart assigns them in this order and never cycles: a ninth series is "Other". */
export const SERIES_SLOTS = Object.freeze([
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
]);

/** The colour of every series past the eighth, folded together as "Other". */
export const OTHER_SERIES = "var(--series-other)";

/** The colour of each part of a request's tokens, the same in every chart. */
export const TOKEN_PART_COLOURS = Object.freeze({
  cached: "var(--token-cached)",
  uncached: "var(--token-uncached)",
  output: "var(--token-output)",
});

/** The colour of each wait cause, by the release's `waited_for` value in the paper's order, the same in every chart. */
export const CAUSE_COLOURS = Object.freeze({
  tool: "var(--cause-tool)", ask_user_tool: "var(--cause-ask-user)", user: "var(--cause-user)", subagent: "var(--cause-subagent)",
});

/** The colour of each transition the figures draw: a request appended to its context, or rewrote it. */
export const TRANSITION_COLOURS = Object.freeze({ append: "var(--transition-append)", mutation: "var(--transition-mutation)" });

/** The six gap-bin colours, shortest gap first: one blue from light to dark. */
export const GAP_BIN_SLOTS = Object.freeze([
  "var(--gap-bin-1)", "var(--gap-bin-2)", "var(--gap-bin-3)", "var(--gap-bin-4)", "var(--gap-bin-5)", "var(--gap-bin-6)",
]);

/** A bin, category or model with fewer rows than this is not drawn: too few rows to show a shape. */
export const MIN_ROWS_PER_BIN = 50;

// The name a series past the eighth takes once folded.
const OTHER_NAME = "Other";

// Joins a bar's x value and series name into one key when summing folded rows.
const KEY_SEPARATOR = "\u0000";

const CHART_HEIGHT = 240; // every chart has the same height, so a grid of figures lines up
const FALLBACK_WIDTH = 480; // the width drawn when the body has not been laid out yet
/** The width of every chart's lines, in pixels: thin lines. */
export const LINE_WIDTH = 2;
const BAR_INSET = 1; // pixels taken off each side of a bar: a 2px gap between neighbouring bars and segments
/** The dash and gap lengths of every dashed line, in pixels: a CDF's median, a percentile, a reference line. */
export const DASH = "4 3";
const MEDIAN_SHARE = 0.5; // the share of rows at which a CDF crosses its median

// The Plot options every chart shares, so every chart has the same ink.
const PLOT_STYLE = Object.freeze({ color: "var(--chart-label)", background: "transparent" });
const PLOT_MARGINS = Object.freeze({ marginTop: 24, marginRight: 24, marginBottom: 36, marginLeft: 52 });
/** The options of every chart's grid lines. */
export const GRID_STYLE = Object.freeze({ stroke: "var(--chart-grid)", strokeOpacity: 1 });
/** The options of every chart's axes. */
export const AXIS_STYLE = Object.freeze({ stroke: "var(--chart-axis)" });
/** The options of every chart's tooltip: Plot's white box would be unreadable in dark mode, so it takes the surface colour. */
export const TIP_STYLE = Object.freeze({ fill: "var(--color-surface)" });

/** The Plot options every chart starts from: its margins, its height, the width of `body`, and its ink. */
export function chartFrame(body) {
  return { ...PLOT_MARGINS, width: chartWidth(body), height: CHART_HEIGHT, style: PLOT_STYLE };
}

/** A map from each distinct name, in the given order, to its series colour; the ninth name and beyond map to `OTHER_SERIES`. */
export function assignColours(names) {
  const colours = new Map();
  for (const name of names) {
    if (colours.has(name)) {
      continue;
    }
    const slot = colours.size < SERIES_SLOTS.length ? SERIES_SLOTS[colours.size] : OTHER_SERIES;
    colours.set(name, slot);
  }
  return colours;
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

/**
 * A figure's caption, `harnesses` being the text that names them: "1,186,582 rows · the paper's harnesses · 16 weeks",
 * or "… · 1 week (2026-08-09)" naming a single week's Sunday.
 */
export function captionText({ rows, harnesses, weeks }) {
  return `${formatCount(rows)} rows · ${harnesses} · ${weeksText(weeks)}`;
}

/** The weeks a caption names: "16 weeks", or "1 week (2026-08-09)" naming a single week's Sunday. */
export function weeksText(weeks) {
  return weeks.length === 1 ? `1 week (${weeks[0]})` : `${weeks.length} weeks`;
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

/** Fill `container` with a figure's title, definition, empty body and caption; return the body to draw into. */
export function renderFigure(container, { title, definition, caption }) {
  const figure = document.createElement("div");
  figure.className = "figure";
  figure.innerHTML = `
    <h3 class="figure-title"></h3>
    <p class="figure-definition"></p>
    <div class="figure-body"></div>
    <p class="figure-caption"></p>`;
  figure.querySelector(".figure-title").textContent = title;
  figure.querySelector(".figure-definition").textContent = definition;
  figure.querySelector(".figure-caption").textContent = caption;
  container.replaceChildren(figure);
  return figure.querySelector(".figure-body");
}

/**
 * Draw into `body` one line per series of `series`, `[{ name, label, points: [{ x, share }] }]`, with share running
 * 0 to 1, each in its colour from `colours` (a map from series name to colour, as `assignColours` gives); the tooltip
 * names a series by its label. `format` writes an x value in the tooltip; `xDomain`, when given, is the x axis's
 * `[low, high]`, the lines cut at its ends.
 */
export async function drawCdf(body, series, { xLabel, logX = false, format = String, colours, xDomain }) {
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const points = cdfPoints(series);
  const names = series.map((one) => one.name);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: logX ? "log" : "linear", domain: xDomain },
    y: { domain: [0, 1] },
    clip: xDomain !== undefined,
    color: colourScale(colours, names),
    marks: [
      Plot.gridX(GRID_STYLE),
      Plot.gridY(GRID_STYLE),
      Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, strokeDasharray: DASH }),
      Plot.axisX({ ...AXIS_STYLE, label: xLabel }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: "%", label: "Share of rows" }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH }),
      Plot.tip(points, Plot.pointerX({ ...TIP_STYLE, x: "x", y: "share", title: (point) => cdfTipText(point, format) })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * Draw into `body` one bar per row of `rows`: `row[x]` along the axis, `row[y]` its height, coloured by `row[fill]`.
 * Series colours follow `order` (a fixed order of fill values, largest first) or the rows' order; series past the
 * eighth fold into "Other", summed into one bar per x. `colours`, when given, is a Map from each fill value to its
 * colour, used instead. Bars stack when `stacked`; `format` writes a y value on the axis and in the tooltip;
 * `xTickFormat`, when given, writes the x axis's ticks; `xDomain`, when given, lists every x value in order, so one
 * with no rows keeps its place; `fillOpacity`, when given, is each bar's opacity, a number or a function of its row.
 * Returns the chart's element.
 */
export async function drawBars(body, rows, options) {
  const { x, y, fill, order, stacked = false, xLabel, yLabel, format = formatCount, xTickFormat, xDomain, fillOpacity } = options;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const names = distinct(order ?? rows.map((row) => row[fill]));
  const foldedRows = sumFolded(foldToOther(rows, fill, names), { x, y, fill });
  const colours = options.colours ?? barColours(names);
  const shown = [...colours.keys()].filter((name) => foldedRows.some((row) => row[fill] === name));
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "band", domain: xDomain ?? distinct(foldedRows.map((row) => row[x])) },
    color: colourScale(colours, shown),
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.axisX({ ...AXIS_STYLE, tickFormat: xTickFormat, label: xLabel }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: format, label: yLabel }),
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

/** The distinct values, in the order of their first appearance. */
export function distinct(values) {
  return [...new Set(values)];
}

function chartWidth(body) {
  return body.clientWidth || FALLBACK_WIDTH;
}

/** A bar chart's colours: each of the first eight of `names` in its series colour, and "Other", which the rest fold into. */
export function barColours(names) {
  const colours = assignColours(names.slice(0, SERIES_SLOTS.length));
  colours.set(OTHER_NAME, OTHER_SERIES);
  return colours;
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

function cdfPoints(series) {
  const points = [];
  for (const one of series) {
    for (const point of one.points) {
      points.push({ name: one.name, label: one.label, x: point.x, share: point.share });
    }
  }
  return points;
}

function cdfTipText(point, format) {
  return `${point.label}\n${format(point.x)}\n${formatShare(point.share)} of rows`;
}

function barTipText(row, { x, y, fill, yLabel, format }) {
  return `${row[fill]}\n${row[x]}\n${yLabel}: ${format(row[y])}`;
}
