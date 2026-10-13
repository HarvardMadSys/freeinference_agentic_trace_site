/**
 * The stacked-bars kind: one stacked bar per value of a named x column, a week or a bin, a segment per series, the
 * series past the eighth of the colours folded into one "Other" segment.
 *
 * Its rows hold a column naming the row's bar, a column naming its series and a column of the segment's value, all
 * three named by the figure; a series may have several rows in one bar, which are summed once folded.
 */

import { AXIS_STYLE, BAR_INSET, chartFrame, colourScale, distinct, GRID_STYLE } from "../shared/charts.js";
import { monthTickFormat, TICK_COUNT, weekTickFormat } from "../axes/ticks.js";
import { OTHER_NAME, SERIES_SLOTS } from "../theme/colours.js";
import { seriesLegend, shownRows } from "../shared/series.js";

const UNTITLED_MARGIN_TOP = 12; // pixels above a chart whose y axis has no title: room for half its top tick's label
// Joins a bar's x value and series name into one key when summing folded rows.
const KEY_SEPARATOR = "\u0000";

/**
 * Draw `rows` into `body` as one stacked bar per x value of the series not in `hidden`, bottom up in the order of their
 * legend's colours, `colours.series` (a Map from series name to colour). Its named parameters:
 * - `xColumn`, `seriesColumn` and `valueColumn`: the columns holding a row's bar, its series and its value, a
 *   segment's height.
 * - `valueLabel`: what a value is, named in the tooltip, "Sessions: 412".
 * - `yLabel`: the value axis's title, none when null or not given, where the card's title already says what the bars
 *   count.
 * - `valueFormat`: how a value is written in the tooltip; `yTickFormat`: on the value axis.
 * - `xLabel`: the x axis's title, none when null or not given; `xTickFormat`: how a tick is written, "" for an
 *   unlabelled one, such as `weekTicks` gives for an axis of weeks.
 * - `weeks`: every week the axis spans, `weeks.json`'s entries, each a bar's place even without rows and its months
 *   labelled once; without it, the bars of the rows' x values.
 * - `margins`: Plot margins in place of the frame's, where the bars should take more of the card's width.
 */
export async function drawStackedBars(rows, body, colours, parameters, hidden) {
  const { xColumn, seriesColumn, valueColumn, valueLabel, valueFormat } = parameters;
  const { xLabel = null, yLabel = null, xTickFormat, yTickFormat, weeks, margins } = parameters;
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const folded = foldedRows(rows, colours.series, { xColumn, seriesColumn, valueColumn });
  const shown = shownRows(folded, seriesColumn, hidden);
  const stacked = [...colours.series.keys()].filter((name) => shown.some((row) => row[seriesColumn] === name));
  const chart = Plot.plot({
    ...barsFrame(body, yLabel, margins),
    x: { type: "band", domain: weeks?.map((entry) => entry.week) ?? distinct(shown.map((row) => row[xColumn])) },
    color: colourScale(colours.series, stacked),
    marks: [
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      Plot.axisX({ ...AXIS_STYLE, tickFormat: xTickFormat, label: xLabel }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: yTickFormat, label: yLabel }),
      Plot.barY(shown, {
        x: xColumn,
        y: valueColumn,
        fill: seriesColumn,
        order: stacked, // the stacking order, bottom up
        inset: BAR_INSET,
        title: (row) => barTipText(row, { xColumn, seriesColumn, valueColumn, valueLabel, valueFormat }),
        tip: true,
      }),
      Plot.ruleY([0], AXIS_STYLE),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The legend of stacked bars: `{ series, colours }`, the series of `colours` (a Map from series name to colour, in the
 * order the legend lists them) that the rows hold once folded, "Other" among them, each labelled by `labels` where it
 * has a label there, else by its name.
 */
export function stackedBarsLegend(rows, colours, { seriesColumn, labels = {} }) {
  const folded = foldToOther(rows, seriesColumn, [...colours.keys()]);
  return seriesLegend(folded, seriesColumn, colours, labels);
}

/**
 * The rows with each series past the first eight names of `colours` renamed "Other", and the rows sharing a bar and a
 * series summed into one on `valueColumn`, in order of first appearance.
 */
export function foldedRows(rows, colours, { xColumn, seriesColumn, valueColumn }) {
  const folded = foldToOther(rows, seriesColumn, [...colours.keys()]);
  return sumFolded(folded, { xColumn, seriesColumn, valueColumn });
}

/** A copy of `rows` with `row[key]` replaced by "Other" where it is not among the first eight distinct `names`. */
export function foldToOther(rows, key, names) {
  const named = distinct(names).slice(0, SERIES_SLOTS.length);
  return rows.map((row) => (named.includes(row[key]) ? row : { ...row, [key]: OTHER_NAME }));
}

/**
 * The rows with every row sharing `row[xColumn]` and `row[seriesColumn]` summed into one on `row[valueColumn]`, in
 * order of first appearance.
 */
export function sumFolded(rows, { xColumn, seriesColumn, valueColumn }) {
  const sums = new Map();
  for (const row of rows) {
    // Two rows belong together when both their bar and their series match; the separator cannot occur in either.
    const barAndSeries = `${row[xColumn]}${KEY_SEPARATOR}${row[seriesColumn]}`;
    const sum = sums.get(barAndSeries);
    if (sum === undefined) {
      sums.set(barAndSeries, { ...row });
    } else {
      sum[valueColumn] += row[valueColumn];
    }
  }
  return [...sums.values()];
}

/**
 * The tick format of an axis of weeks, the Sundays in `row[xColumn]`: with `weeks` (`weeks.json`'s entries), each
 * month they span labelled once; without, the first week of each month of the rows' weeks.
 */
export function weekTicks(rows, xColumn, weeks) {
  if (weeks !== undefined) {
    return monthTickFormat(weeks);
  }
  return weekTickFormat(distinct(rows.map((row) => row[xColumn])));
}

// The frame of the bars: `margins` in place of the frame's where given, and a small top margin under no axis title.
function barsFrame(body, yLabel, margins) {
  const frame = { ...chartFrame(body), ...margins };
  if (yLabel === null) {
    frame.marginTop = UNTITLED_MARGIN_TOP;
  }
  return frame;
}

// A segment's tooltip: its series, its bar's x value, and its value, "Sessions: 412".
function barTipText(row, { xColumn, seriesColumn, valueColumn, valueLabel, valueFormat }) {
  return `${row[seriesColumn]}\n${row[xColumn]}\n${valueLabel}: ${valueFormat(row[valueColumn])}`;
}
