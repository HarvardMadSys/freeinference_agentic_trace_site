/**
 * The week-bars kind: one stacked bar per week, a segment per series, the series past the eighth of the colours folded
 * into one "Other" segment.
 *
 * Its rows hold `week` (the week's Sunday), a column naming the row's series and a column of the segment's value, both
 * named by the figure; a series may have several rows in one week, which are summed once folded.
 */

import { drawBars, foldToOther, sumFolded } from "../shared/charts.js";
import { monthTickFormat, weekTickFormat } from "../axes/ticks.js";
import { seriesLegend } from "../figures/figure_rows.js";
import { shownRows } from "../explore/legend.js";

const WEEK_COLUMN = "week"; // the column of every week-bars query naming each row's week

/**
 * Draw `rows` into `body` as one stacked bar per week of the series not in `hidden`, bottom up in the order of their
 * legend's colours, `colours.series` (a Map from series name to colour). Its named parameters:
 * - `seriesColumn` and `valueColumn`: the columns holding a row's series and its value, a segment's height.
 * - `valueLabel`: what a value is, named in the tooltip, "Sessions: 412".
 * - `yLabel`: the value axis's title, none when null, where the card's title already says what the bars count.
 * - `valueFormat`: how a value is written in the tooltip; `yTickFormat`: on the value axis.
 * - `weeks`: every week the axis spans, `weeks.json`'s entries, each a bar's place even without rows and its months
 *   labelled once; without it, the rows' weeks, the first of each month labelled.
 * - `margins`: Plot margins in place of the frame's, where the bars should take more of the card's width.
 */
export async function drawWeekBars(rows, body, colours, parameters, hidden) {
  const { seriesColumn, valueColumn, valueLabel, yLabel, valueFormat, yTickFormat, weeks, margins } = parameters;
  const folded = foldedWeekRows(rows, seriesColumn, valueColumn, colours.series);
  await drawBars(body, shownRows(folded, seriesColumn, hidden), {
    x: WEEK_COLUMN,
    y: valueColumn,
    fill: seriesColumn,
    colours: colours.series,
    xLabel: null,
    yLabel: valueLabel,
    yAxisLabel: yLabel,
    format: valueFormat,
    yTickFormat,
    xTickFormat: weekTicks(rows, weeks),
    xDomain: weeks?.map((entry) => entry.week),
    margins,
  });
}

/**
 * The legend of week bars: `{ series, colours }`, the series of `colours` (a Map from series name to colour, in the
 * order the legend lists them) that the folded rows hold, "Other" among them, each labelled by `labels` where it has a
 * label there, else by its name.
 */
export function weekBarsLegend(rows, colours, { seriesColumn, valueColumn, labels = {} }) {
  return seriesLegend(foldedWeekRows(rows, seriesColumn, valueColumn, colours), seriesColumn, colours, labels);
}

/**
 * The rows with each series past the first eight names of `colours` renamed "Other", and the rows sharing a week and a
 * series summed into one on `valueColumn`, in order of first appearance.
 */
export function foldedWeekRows(rows, seriesColumn, valueColumn, colours) {
  const folded = foldToOther(rows, seriesColumn, [...colours.keys()]);
  return sumFolded(folded, { x: WEEK_COLUMN, y: valueColumn, fill: seriesColumn });
}

/**
 * The week axis's tick format: with `weeks` (`weeks.json`'s entries), each month they span labelled once; without, the
 * first week of each month of the rows' weeks.
 */
export function weekTicks(rows, weeks) {
  if (weeks !== undefined) {
    return monthTickFormat(weeks);
  }
  return weekTickFormat([...new Set(rows.map((row) => row[WEEK_COLUMN]))]);
}
