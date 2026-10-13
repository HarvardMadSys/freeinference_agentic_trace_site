/**
 * The ranked kind: sessions ranked by a share and cut into rank bins, each bin's mean share of each part stacked as an
 * area over the session percentile, from the first part at the bottom.
 *
 * Its rows are a rank-bin query's: one bin per row, `percentile` (the bin's middle, in percent of the sessions
 * ranked), one column per part holding the bin's mean share of it, and `bin_sessions`, the bin's sessions. The parts
 * are columns, not rows, so the kind itself leaves out the parts the legend hides.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE } from "../shared/charts.js";
import { percentTick } from "../axes/ticks.js";
import { formatCount, formatPercent, formatShare } from "../shared/format.js";
import { partsLegend } from "../shared/series.js";

const PERCENTILE_DOMAIN = Object.freeze([0, 100]); // the x axis spans every ranked session, whatever bins are hidden
const SHARE_DOMAIN = Object.freeze([0, 1]); // the y axis spans a whole share, whatever parts are hidden

/**
 * Draw `rows` into `body` as a stacked area over the session percentile of each part not in `hidden`, each in its
 * colour of `colours.series` (a Map from part to colour), with a tooltip per bin. Its named parameters:
 * - `parts`: each part's column with its label, in the stack's order, bottom up.
 * - `yLabel`: what the shares are of, the value axis's title.
 * Required: both.
 * Needs the figure's legend: its colours are `colours.series`.
 */
export async function drawRanked(rows, body, colours, { parts, yLabel }, hidden) {
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const shown = Object.keys(parts).filter((part) => !hidden.has(part));
  const tips = rankTips(rows, shown, parts);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { domain: PERCENTILE_DOMAIN },
    y: { domain: SHARE_DOMAIN },
    color: colourScale(colours.series, shown),
    marks: [
      Plot.gridY(GRID_STYLE),
      // Its ticks run from "0%" to "100%", as the y axis's do.
      Plot.axisX({ ...AXIS_STYLE, label: "Session percentile", tickFormat: percentTick }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: yLabel }),
      Plot.areaY(stackedSharePoints(rows, shown), { x: "percentile", y: "share", fill: "part", order: shown }),
      Plot.tip(tips, Plot.pointerX({ x: "percentile", y: "top", title: "text" })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The legend of a ranked figure: `{ series, colours }`, every part of `parts` (part to label), bottom up in the stack,
 * in its colour of `colours` (a Map from part to colour), whichever parts the rows hold.
 */
export function rankedLegend(rows, colours, { parts }) {
  return partsLegend(parts, colours);
}

/**
 * The points of a stacked area of rank bins: one `{ part, percentile, share }` per part of `parts` (column names of
 * the rows) and row, each part's points in the rows' order.
 */
export function stackedSharePoints(rows, parts) {
  const points = [];
  for (const part of parts) {
    for (const row of rows) {
      points.push({ part, percentile: row.percentile, share: row[part] });
    }
  }
  return points;
}

/**
 * The tooltip of each rank bin: `{ percentile, top, text }`, `top` the sum of its shares of `parts` (the top of the
 * stack, where the tooltip points) and `text` naming each part by its label in `labels`, its share, and the bin's
 * sessions (`bin_sessions`).
 */
export function rankTips(rows, parts, labels) {
  const tips = [];
  for (const row of rows) {
    const lines = [`Percentile ${row.percentile.toFixed(1)}`];
    let top = 0;
    for (const part of parts) {
      lines.push(`${labels[part]}: ${formatShare(row[part])}`);
      top += row[part];
    }
    lines.push(`${formatCount(row.bin_sessions)} sessions`);
    tips.push({ percentile: row.percentile, top, text: lines.join("\n") });
  }
  return tips;
}
