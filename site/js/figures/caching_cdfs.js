/**
 * The Prefix-caching section's CDF of the hit ratio after a gap of each length: one line per gap bin, the shortest and
 * the longest gaps named on their lines. No other CDF writes a series' name on its line, so this one has a plain
 * draw, built from the CDF kind's helpers (`charts/cdf.js`); the section's other CDFs are drawn by the kind, in
 * `caching_gaps.js`.
 *
 * Its figure entry, whose fields CONTRIBUTING.md defines, is listed in `caching.js` with the section's others. Its rows
 * are a CDF query's (`charts/cdf.js`), one series per gap bin; a gap bin has the same colour in every chart, from
 * `theme/colours.js`.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, DASH, GRID_STYLE, LINE_LABEL_STYLE, LINE_WIDTH, X_INSET,
} from "../shared/charts.js";
import { cdfPoints, cdfSeries, cdfTipText, MEDIAN_SHARE } from "../charts/cdf.js";
import { TICK_COUNT } from "../axes/ticks.js";
import { GAP_BIN_SLOTS } from "../theme/colours.js";
import { formatPercent, formatShare } from "../shared/format.js";
import { seriesLegend } from "../shared/series.js";
import { HIT_RATIO_DOMAIN } from "./caching_gaps.js";

// The gap bins' labels, shortest gap first, as the pipeline's `gaps.GAP_BINS` names them. tests/
// test_pipeline_mirrors_caching.py checks them against the pipeline.
const GAP_BIN_LABELS = Object.freeze(["<1m", "1–5m", "5–15m", "15–30m", "30m–1h", ">1h"]);
// How a legend and a tooltip write each gap bin, in the words every duration is written in.
const GAP_BIN_TEXT = Object.freeze({ "<1m": "Under 1 min", "1–5m": "1–5 min", "5–15m": "5–15 min",
  "15–30m": "15–30 min", "30m–1h": "30 min–1 h", ">1h": "Over 1 h" });

// The shortest and longest gap bins, named off the lines: the longest above its line, where no line lies above it; the
// shortest, which hugs the axis under the others, beside its right end at a share of 10%, where it rises alone.
const GAP_BIN_LINE_LABELS = Object.freeze([
  Object.freeze({ name: "<1m", at: 0.1, placement: "end" }),
  Object.freeze({ name: ">1h", at: 0.5, placement: "above" }),
]);
const LABEL_ABOVE_OFFSET = -9; // pixels from a point up to a label written above it on its line
const LABEL_END_OFFSET = 6; // pixels from a line's right end across to a label written beside it
// Pixels the right margin grows by to hold a label written beside a line's right end, "Under 1 min".
const LABEL_END_ROOM = 64;
// A chart narrower than this, in pixels, keeps its plot's width and writes no label beside a line's end; its legend
// names the line.
const MIN_WIDTH_FOR_END_LABELS = 420;

/** The figure of the hit ratio's CDF per gap bin. */
export const HIT_RATIO_CDF_BY_GAP_BIN = Object.freeze({
  name: "hit_ratio_cdf_by_gap_bin",
  title: "Cache hits after a wait",
  insight: "Taking a break can turn reused context into fresh work.",
  definition: "Each line groups requests by how long they waited after the previous request ended. It shows the percentage of requests at or below each cache hit ratio: cached input tokens divided by total input tokens. Lighter lines show shorter waits.",
  caption: "Prefix reuse stays high when requests arrive within one minute, but falls to roughly 58% after 15–30 minutes and just 18% after gaps longer than an hour.",
  drawsLines: true,
  query: "figures/hit_ratio_cdf_by_gap_bin",
  binColumn: "series",
  seriesColumn: "series",
  legend: (rows, colours, seriesColumn) => seriesLegend(rows, seriesColumn, gapBinColours(), GAP_BIN_TEXT),
  draw: drawHitRatioByGapBin,
});

/** A map from each gap bin's label, shortest gap first, to its colour. */
export function gapBinColours() {
  const colours = new Map();
  for (let index = 0; index < GAP_BIN_LABELS.length; index += 1) {
    colours.set(GAP_BIN_LABELS[index], GAP_BIN_SLOTS[index]);
  }
  return colours;
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

/**
 * Draw one CDF line per gap bin of the rows, in its legend's colour, a dashed rule at the median, and the shortest and
 * longest gaps named on their lines. Only the lines are cut at the plot's edge, as the CDF kind cuts them; a label
 * beside a line's end is written in room the right margin keeps for it.
 */
async function drawHitRatioByGapBin(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const series = cdfSeries(rows, GAP_BIN_LABELS, { labels: GAP_BIN_TEXT });
  const points = cdfPoints(series);
  const frame = chartFrame(body);
  const labels = labelsThatFit(lineLabelPoints(series, GAP_BIN_LINE_LABELS), frame.width);
  const hasEndLabel = labels.some((label) => label.placement === "end");
  const chart = Plot.plot({
    ...frame,
    marginRight: frame.marginRight + (hasEndLabel ? LABEL_END_ROOM : 0),
    x: { type: "linear", domain: HIT_RATIO_DOMAIN, inset: X_INSET },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, series.map((one) => one.name)),
    marks: [
      Plot.gridX(GRID_STYLE),
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      Plot.ruleY([MEDIAN_SHARE], { ...AXIS_STYLE, strokeDasharray: DASH }),
      Plot.axisX({ ...AXIS_STYLE, label: "Hit ratio", tickFormat: formatPercent }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: formatPercent, label: "Share of requests" }),
      Plot.line(points, { x: "x", y: "share", stroke: "name", strokeWidth: LINE_WIDTH, clip: true }),
      ...lineLabelMarks(Plot, labels),
      Plot.tip(points, Plot.pointerX({ x: "x", y: "share", title: (point) => cdfTipText(point, formatShare) })),
    ],
  });
  body.replaceChildren(chart);
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
// its label inside the chart; one beside a line's right end, in the room the right margin keeps.
function lineLabelMarks(Plot, labels) {
  const above = labels.filter((label) => label.placement === "above");
  const atEnds = labels.filter((label) => label.placement === "end");
  return [
    Plot.text(above, {
      x: "x", y: "share", text: "label", dy: LABEL_ABOVE_OFFSET, textAnchor: "end", ...LINE_LABEL_STYLE,
    }),
    Plot.text(atEnds, {
      x: "x", y: "share", text: "label", dx: LABEL_END_OFFSET, textAnchor: "start", ...LINE_LABEL_STYLE,
    }),
  ];
}
