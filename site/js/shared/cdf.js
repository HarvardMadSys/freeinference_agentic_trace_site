/**
 * The CDF drawing every CDF figure shares: one line per series of the share of rows at or below each value, a dashed
 * rule at the median, and, where asked, a series' label written on its line.
 */

import {
  AXIS_STYLE, CHART_HEIGHT, chartFrame, colourScale, DASH, GRID_STYLE, LINE_LABEL_STYLE, LINE_WIDTH, TIP_STYLE, X_INSET,
} from "./charts.js";
import { formatPercent, formatShare } from "./format.js";
import { axisWithTicks, extent, logAxisTicks, TICK_COUNT } from "../axes/ticks.js";

const MEDIAN_SHARE = 0.5; // the share of rows at which a CDF crosses its median
// Pixels from a point to a label written above or below it on its line.
const LINE_LABEL_OFFSETS = Object.freeze({ above: -9, below: 14 });

/**
 * Draw into `body` one line per series of `series`, `[{ name, label, points: [{ x, share }] }]`, with share running
 * 0 to 1, each in its colour from `colours` (a map from series name to colour, as `assignColours` gives); the tooltip
 * names a series by its label. `format` writes an x value in the tooltip, `xTickFormat` (if given) on the axis;
 * `xDomain`, when given, is the x axis's `[low, high]`, the lines cut at its ends; `xTicks`, when given, are the x
 * axis's ticks, else a log axis ticks its powers of ten (`logAxisTicks`); `xLabel` and `yLabel` title the axes, none
 * when null; `height`, when given, replaces the chart's height; `lineLabels`, when given, are the series whose label
 * is written on its line, as `lineLabelPoints` takes them.
 */
export async function drawCdf(body, series, options) {
  const { xLabel = null, yLabel = "Share of requests", logX = false, format = String, xTickFormat, colours } = options;
  const { xDomain, height = CHART_HEIGHT, lineLabels = [] } = options;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  const points = cdfPoints(series);
  const names = series.map((one) => one.name);
  const xTicks = options.xTicks ?? (logX ? logAxisTicks(xDomain ?? extent(points.map((point) => point.x))) : undefined);
  const chart = Plot.plot({
    ...chartFrame(body),
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
      ...lineLabelMarks(Plot, lineLabelPoints(series, lineLabels)),
      Plot.tip(points, Plot.pointerX({ ...TIP_STYLE, x: "x", y: "share", title: (point) => cdfTipText(point, format) })),
    ],
  });
  body.replaceChildren(chart);
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

/**
 * Where a series' label is written on its line, for each of `lineLabels`, `[{ name, at, placement }]`: on the point of
 * the series `name` nearest the value `at`, above or below its line (`placement`), as `{ x, share, label, placement }`.
 * A series with no points has no label.
 */
export function lineLabelPoints(series, lineLabels) {
  const labels = [];
  for (const { name, at, placement } of lineLabels) {
    const one = series.find((candidate) => candidate.name === name);
    if (one === undefined || one.points.length === 0) {
      continue;
    }
    let nearest = one.points[0];
    for (const point of one.points) {
      if (Math.abs(point.x - at) < Math.abs(nearest.x - at)) {
        nearest = point;
      }
    }
    labels.push({ x: nearest.x, share: nearest.share, label: one.label, placement });
  }
  return labels;
}

// A text mark per placement, each label set above or below its point.
function lineLabelMarks(Plot, labels) {
  const marks = [];
  for (const [placement, dy] of Object.entries(LINE_LABEL_OFFSETS)) {
    const placed = labels.filter((label) => label.placement === placement);
    marks.push(Plot.text(placed, { x: "x", y: "share", text: "label", dy, ...LINE_LABEL_STYLE }));
  }
  return marks;
}
