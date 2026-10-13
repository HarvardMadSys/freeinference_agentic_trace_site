/**
 * The CDF drawing of the CDF figures not yet drawn by the CDF kind (`charts/cdf.js`): one line per series of the share
 * of rows at or below each value, a dashed rule at the median, and, where asked, a series' label written on its line.
 */

import {
  AXIS_STYLE, CHART_HEIGHT, chartFrame, colourScale, DASH, GRID_STYLE, LINE_LABEL_STYLE, LINE_WIDTH, X_INSET,
} from "./charts.js";
import { formatPercent, formatShare } from "./format.js";
import { axisWithTicks, extent, logAxisTicks, TICK_COUNT } from "../axes/ticks.js";
import { cdfPoints, MEDIAN_SHARE } from "../charts/cdf.js";

const LABEL_ABOVE_OFFSET = -9; // pixels from a point up to a label written above it on its line
const LABEL_END_OFFSET = 6; // pixels from a line's right end across to a label written beside it
// Pixels the right margin grows by to hold a label written beside a line's right end, "Under 1 min".
const LABEL_END_ROOM = 64;
// A chart narrower than this, in pixels, keeps its plot's width and writes no label beside a line's end; its legend
// names the line.
const MIN_WIDTH_FOR_END_LABELS = 420;

/**
 * Draw into `body` one line per series of `series`, `[{ name, label, points: [{ x, share }] }]`, with share running
 * 0 to 1, each in its colour from `colours` (a map from series name to colour, as `assignColours` gives); the tooltip
 * names a series by its label. `format` writes an x value in the tooltip, `xTickFormat` (if given) on the axis;
 * `xDomain`, when given, is the x axis's `[low, high]`, the lines cut at its ends; `xTicks`, when given, are the x
 * axis's ticks, else a log axis ticks its powers of ten (`logAxisTicks`); `xLabel` and `yLabel` title the axes, none
 * when null; `height`, when given, replaces the chart's height; `lineLabels`, when given, are the series whose label
 * is written by its line, as `lineLabelPoints` takes them.
 */
export async function drawCdfSeries(body, series, options) {
  const { xLabel = null, yLabel = "Share of requests", logX = false, format = String, xTickFormat, colours } = options;
  const { xDomain, height = CHART_HEIGHT, lineLabels = [] } = options;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const points = cdfPoints(series);
  const names = series.map((one) => one.name);
  const xTicks = options.xTicks ?? (logX ? logAxisTicks(xDomain ?? extent(points.map((point) => point.x))) : undefined);
  const frame = chartFrame(body);
  const labels = labelsThatFit(lineLabelPoints(series, lineLabels), frame.width);
  // A label beside a line's end is written in room the right margin keeps for it.
  const hasEndLabel = labels.some((label) => label.placement === "end");
  const chart = Plot.plot({
    ...frame,
    marginRight: frame.marginRight + (hasEndLabel ? LABEL_END_ROOM : 0),
    height,
    x: { type: logX ? "log" : "linear", domain: xDomain, inset: X_INSET },
    y: { domain: [0, 1] },
    clip: xDomain !== undefined,
    color: colourScale(colours, names),
    marks: [
      xTicks === undefined ? Plot.gridX(GRID_STYLE) : Plot.gridX(xTicks, GRID_STYLE),
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, strokeDasharray: DASH }),
      axisWithTicks(Plot.axisX, xTicks, { ...AXIS_STYLE, label: xLabel, tickFormat: xTickFormat }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: formatPercent, label: yLabel }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH }),
      ...lineLabelMarks(Plot, labels),
      Plot.tip(points, Plot.pointerX({ x: "x", y: "share", title: (point) => cdfTipText(point, format) })),
    ],
  });
  body.replaceChildren(chart);
}

function cdfTipText(point, format) {
  return `${point.label}\n${format(point.x)}\n${formatShare(point.share)} at or below`;
}

/**
 * Where a series' label is written by its line, for each of `lineLabels`, `[{ name, at, placement }]`, as
 * `{ x, share, label, placement }`: with `placement` "above", above the point of the series `name` nearest the value
 * `at`, ending at it; with "end", beside the line's right end, at the height of the share `at`, where a line that
 * rises there is told apart from the others. A series with no points has no label.
 */
export function lineLabelPoints(series, lineLabels) {
  const labels = [];
  for (const { name, at, placement } of lineLabels) {
    const one = series.find((candidate) => candidate.name === name);
    if (one === undefined || one.points.length === 0) {
      continue;
    }
    if (placement === "end") {
      labels.push({ x: one.points.at(-1).x, share: at, label: one.label, placement });
    } else {
      const nearest = nearestPoint(one.points, at);
      labels.push({ x: nearest.x, share: nearest.share, label: one.label, placement });
    }
  }
  return labels;
}

/**
 * The labels of `labels` a chart `width` pixels wide writes: every one, but none beside a line's end on a chart too
 * narrow to give it room.
 */
export function labelsThatFit(labels, width) {
  if (width >= MIN_WIDTH_FOR_END_LABELS) {
    return labels;
  }
  return labels.filter((label) => label.placement !== "end");
}

// The point of `points` whose x is nearest `at`.
function nearestPoint(points, at) {
  let nearest = points[0];
  for (const point of points) {
    if (Math.abs(point.x - at) < Math.abs(nearest.x - at)) {
      nearest = point;
    }
  }
  return nearest;
}

// The text marks of the labels: one above its point and ending at it, so that a point near the chart's right edge keeps
// its label inside the chart; one beside a line's right end, in the room the right margin keeps, unclipped.
function lineLabelMarks(Plot, labels) {
  const above = labels.filter((label) => label.placement === "above");
  const atEnds = labels.filter((label) => label.placement === "end");
  return [
    Plot.text(above, { x: "x", y: "share", text: "label", dy: LABEL_ABOVE_OFFSET, textAnchor: "end", ...LINE_LABEL_STYLE }),
    Plot.text(atEnds, {
      x: "x", y: "share", text: "label", dx: LABEL_END_OFFSET, textAnchor: "start", clip: false, ...LINE_LABEL_STYLE,
    }),
  ];
}
