/**
 * The CDF kind: one line per series of the share of rows at or below each value, on a log or a linear x axis, its
 * median marked either by a dashed rule across the chart at 50% or, where the rows carry each series' median, by a dot
 * and the value on each line.
 *
 * Its rows are a CDF query's: one point per row, `series` (the series' name), `x` (a value) and `share` (the share of
 * the series' rows at or below it), each series' points in order of `x`. A figure that marks its medians names the
 * column holding each series' median, the same on every row of the series.
 */

import {
  AXIS_STYLE, CHART_HEIGHT, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, X_INSET,
} from "../shared/charts.js";
import { formatPercent, formatShare } from "../shared/format.js";
import { axisWithTicks, extent, isNarrowChart, logAxisTicks, TICK_COUNT } from "../axes/ticks.js";
import { seriesLegend, shownRows } from "../shared/series.js";

const SERIES_COLUMN = "series"; // the column of a CDF query naming each point's series
/** The share of rows at which a CDF crosses its median. */
export const MEDIAN_SHARE = 0.5;
const MEDIAN_RADIUS = 3; // pixels; the dot on each median
const MEDIAN_LABEL_OFFSET = 8; // pixels from a median's dot to its value, along each axis
// A median's value: in the chart's ink, ringed in the card's colour so that a line it crosses does not cut its text.
const MEDIAN_LABEL_STYLE = Object.freeze({
  fill: "currentColor", stroke: "var(--color-surface)", strokeWidth: 3, paintOrder: "stroke",
});

/**
 * Draw `rows` into `body`, one line per series in its legend's colour and order (`colours.series`), leaving out the
 * series in `hidden`. Its named parameters:
 * - `labels`: each series' label by its name, for the tooltip; a series without one is labelled by its name.
 * - `floor`: a value below it is drawn at it, so that a zero has a place on a log axis.
 * - `logScale`: whether the x axis is a log one.
 * - `xDomain`: the x axis's `[low, high]`, the lines cut at its ends; else the values' own range.
 * - `xTicks`: the x axis's ticks; else a log axis's powers of ten, a linear axis's Plot's own.
 * - `narrowXTicks`: the ticks on a narrow chart, where `xTicks` would crowd; else `xTicks`.
 * - `xTickFormat`: how a tick is written; `xLabel` and `yLabel`: the axes' titles, none when null or not given.
 * - `valueFormat`: how a value is written in the tooltip and a median's label.
 * - `medianColumn`: the column holding each series' median, marked with a dot and its value; without it, a dashed
 *   rule marks 50%.
 * - `shareNoun`: what a share is of in the tooltip, "45.0% of prompts"; without it, "45.0% at or below".
 * - `callout(Plot, rows, medians)`: the marks of a note the kind does not draw, from the rows drawn and the medians
 *   marked (`seriesMedians`), laid over the lines.
 * - `height`: the chart's height in pixels, a frame size for a chart beside a tall neighbour; else every chart's.
 * Required: `valueFormat`. Only the lines are cut at the plot's edge; the median's marks and the tooltip are not.
 * Needs the figure's legend: its colours are `colours.series`.
 */
export async function drawCdf(rows, body, colours, parameters, hidden) {
  const { labels = {}, floor = -Infinity, logScale, xDomain, xTicks, narrowXTicks, xTickFormat } = parameters;
  const { xLabel = null, yLabel = null, valueFormat, medianColumn, shareNoun, callout } = parameters;
  const { height = CHART_HEIGHT } = parameters;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const shown = shownRows(rows, SERIES_COLUMN, hidden);
  const series = cdfSeries(shown, [...colours.series.keys()], { labels, floor });
  const points = cdfPoints(series);
  const medians = seriesMedians(shown, series.map((one) => one.name), medianColumn, floor);
  const frame = { ...chartFrame(body), height };
  const ticks = drawnTicks({ logScale, xDomain, xTicks, narrowXTicks }, points, frame.width);
  const chart = Plot.plot({
    ...frame,
    x: { type: logScale ? "log" : "linear", domain: xDomain, inset: X_INSET },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, series.map((one) => one.name)),
    marks: [
      ticks === undefined ? Plot.gridX(GRID_STYLE) : Plot.gridX(ticks, GRID_STYLE),
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      ...medianRule(Plot, medianColumn),
      axisWithTicks(Plot.axisX, ticks, { ...AXIS_STYLE, label: xLabel, tickFormat: xTickFormat }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: formatPercent, label: yLabel }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH, clip: xDomain !== undefined }),
      ...medianMarks(Plot, medians, valueFormat),
      ...calloutMarks(Plot, callout, shown, medians),
      Plot.tip(points, Plot.pointerX({
        x: "x", y: "share", title: (point) => cdfTipText(point, valueFormat, shareNoun),
      })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The legend of a CDF: `{ series, colours }`, the series of `colours` (a Map from series name to colour, in the order
 * the legend lists them) that the rows hold, each labelled by `labels` where it has a label there, else by its name.
 */
export function cdfLegend(rows, colours, { labels = {} } = {}) {
  return seriesLegend(rows, SERIES_COLUMN, colours, labels);
}

/**
 * The series of a CDF query's rows, in the order of `names` (series names in the rows), as
 * `[{ name, label, points: [{ x, share }] }]`; a series' label is `labels[name]` when given, else its name.
 * A series with no rows is left out. An `x` below `floor` is drawn at `floor`, so a zero has a place on a log axis.
 */
export function cdfSeries(rows, names, { labels = {}, floor = -Infinity } = {}) {
  const series = [];
  for (const name of names) {
    const points = [];
    for (const row of rows) {
      if (row[SERIES_COLUMN] === name) {
        points.push({ x: Math.max(row.x, floor), share: row.share });
      }
    }
    if (points.length > 0) {
      series.push({ name, label: Object.hasOwn(labels, name) ? labels[name] : name, points });
    }
  }
  return series;
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

/**
 * The median of each series of `names` that the rows hold, read from `medianColumn`, smallest first:
 * `[{ series, median, x }]`, `x` where it is drawn, raised to `floor` as its line is; none without a median column.
 */
export function seriesMedians(rows, names, medianColumn, floor = -Infinity) {
  if (medianColumn === undefined) {
    return [];
  }
  const medians = [];
  for (const name of names) {
    const row = rows.find((candidate) => candidate[SERIES_COLUMN] === name);
    if (row !== undefined) {
      medians.push({ series: name, median: row[medianColumn], x: Math.max(row[medianColumn], floor) });
    }
  }
  return medians.sort((first, second) => first.median - second.median);
}

/**
 * The x ticks a chart `width` pixels wide draws: `narrowXTicks` on a narrow chart when given, else `xTicks`, else a log
 * axis's powers of ten over its domain or its `points`, else none, for Plot's own.
 */
export function drawnTicks({ logScale, xDomain, xTicks, narrowXTicks }, points, width) {
  if (isNarrowChart(width) && narrowXTicks !== undefined) {
    return narrowXTicks;
  }
  if (xTicks !== undefined || !logScale) {
    return xTicks;
  }
  return logAxisTicks(xDomain ?? extent(points.map((point) => point.x)));
}

/** A point's tooltip: its series' label, its value, and the share at or below it, or of `shareNoun` where given. */
export function cdfTipText(point, valueFormat, shareNoun) {
  const share = shareNoun === undefined ? "at or below" : `of ${shareNoun}`;
  return `${point.label}\n${valueFormat(point.x)}\n${formatShare(point.share)} ${share}`;
}

// The dashed rule at 50%, where each line crosses its median; none where the medians are marked on the lines.
function medianRule(Plot, medianColumn) {
  if (medianColumn !== undefined) {
    return [];
  }
  return [Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, strokeDasharray: DASH })];
}

// The marks of the figure's callout, from the rows drawn and the medians marked; none without a callout.
function calloutMarks(Plot, callout, shown, medians) {
  if (callout === undefined) {
    return [];
  }
  return callout(Plot, shown, medians);
}

// A dot on each median, the smallest's value above it to the left and the others' below them to the right, so that
// two medians' values keep apart.
function medianMarks(Plot, medians, valueFormat) {
  if (medians.length === 0) {
    return [];
  }
  return [
    Plot.dot(medians, { x: "x", y: MEDIAN_SHARE, fill: "series", r: MEDIAN_RADIUS }),
    Plot.text(medians.slice(0, 1), {
      ...MEDIAN_LABEL_STYLE, x: "x", y: MEDIAN_SHARE, text: (median) => valueFormat(median.median),
      textAnchor: "end", dx: -MEDIAN_LABEL_OFFSET, dy: -MEDIAN_LABEL_OFFSET,
    }),
    Plot.text(medians.slice(1), {
      ...MEDIAN_LABEL_STYLE, x: "x", y: MEDIAN_SHARE, text: (median) => valueFormat(median.median),
      textAnchor: "start", dx: MEDIAN_LABEL_OFFSET, dy: MEDIAN_LABEL_OFFSET,
    }),
  ];
}
