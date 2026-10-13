/**
 * A chart's series: the rows of the series its legend does not hide, the rows of the series with a colour of their
 * own, and the legend itself, `{ series, colours }`, the series it lists, each `{ name, label }`, and their colours, a
 * Map from name to colour. These are plain functions, tested with `node --test`.
 */

import { slottedColours } from "../theme/colours.js";

/** The rows whose series, `row[seriesColumn]`, is not in `hidden`, in their order. */
export function shownRows(rows, seriesColumn, hidden) {
  return rows.filter((row) => !hidden.has(row[seriesColumn]));
}

/**
 * The rows whose `column` names a series with one of the eight series colours of `colours` (a Map from name to
 * colour): a line per model or provider is drawn only for these, since one in the Other grey could not be told apart.
 */
export function rowsWithSeriesColour(rows, column, colours) {
  const coloured = slottedColours(colours);
  return rows.filter((row) => coloured.has(row[column]));
}

/**
 * The legend of a figure whose rows each name their series in `seriesColumn`: `{ series, colours }`, the series of
 * `colours` (a Map from series name to colour, in the order the legend lists them) that the rows hold, each
 * `{ name, label }` with its label from `labels` where it has one, else its name, and `colours` itself.
 */
export function seriesLegend(rows, seriesColumn, colours, labels = {}) {
  const present = new Set(rows.map((row) => row[seriesColumn]));
  const series = [];
  for (const name of colours.keys()) {
    if (present.has(name)) {
      series.push({ name, label: Object.hasOwn(labels, name) ? labels[name] : name });
    }
  }
  return { series, colours };
}

/** The legend of a figure whose parts are columns: each part of `labels` (part to label), in its colour of `colours`. */
export function partsLegend(labels, colours) {
  const series = Object.entries(labels).map(([name, label]) => ({ name, label }));
  return { series, colours };
}
