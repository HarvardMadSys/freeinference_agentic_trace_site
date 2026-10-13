/**
 * What the Explore page does to a figure's rows before drawing them: the rows of a series with a colour of its own,
 * thin bins hidden, and its line of rows (the rows it rests on, the weeks not simulated and the bins hidden).
 *
 * A figure's rows belong to bins: the rows sharing the value of the figure's `binColumn` (a size bin, a week, or
 * a CDF series), or, when `binColumn` is null, each row alone. Every row of a bin carries the bin's count, the number
 * of rows of the data it rests on, in the column `rows`. These are plain functions, tested with `node --test`.
 */

import { dropThinBins, MIN_ROWS_PER_BIN } from "../shared/charts.js";
import { formatCount } from "../shared/format.js";
import { slottedColours } from "../theme/colours.js";

// The column of every figure query that holds a bin's count: the number of rows of the data behind the bin.
const COUNT_COLUMN = "rows";

// What a hidden bin is called in the line of rows, singular and plural, by the figure's bin column; any other is a "bin".
const HIDDEN_NOUNS = Object.freeze({
  series: ["series", "series"],
  week: ["week", "weeks"],
  category: ["category", "categories"],
  waited_for: ["cause", "causes"],
});
const DEFAULT_HIDDEN_NOUN = ["bin", "bins"];

/**
 * The rows whose `column` names a series with one of the eight series colours of `colours` (a Map from name to
 * colour): a line per model or provider is drawn only for these, since one in the Other grey could not be told apart.
 */
export function rowsWithSeriesColour(rows, column, colours) {
  const coloured = slottedColours(colours);
  return rows.filter((row) => coloured.has(row[column]));
}

/**
 * `{ rows, hidden }`: the rows of the bins whose count is at least `MIN_ROWS_PER_BIN`, in their order, and how
 * many bins were hidden.
 */
export function dropThinGroups(rows, binColumn) {
  const { rows: keptBins, hidden } = dropThinBins(binCounts(rows, binColumn), "count");
  const keptNames = new Set(keptBins.map((bin) => bin.name));
  return { rows: rows.filter((row, index) => keptNames.has(binName(row, index, binColumn))), hidden };
}

/**
 * The number of rows a figure rests on: its bins' counts summed, or, when every series is drawn from the same
 * rows (`seriesOverSameRows`), the largest count, so those rows are counted once.
 */
export function restingRowCount(rows, { binColumn, seriesOverSameRows = false }) {
  const counts = binCounts(rows, binColumn).map((bin) => bin.count);
  if (seriesOverSameRows) {
    return Math.max(0, ...counts);
  }
  let total = 0;
  for (const count of counts) {
    total += count;
  }
  return total;
}

/**
 * The count of the rows a figure rests on: "1,234 rows", or, for a figure whose series count different
 * things (`seriesNouns`, from series name to plural noun), each shown series' count: "84,239 turns · 12,002 sessions".
 */
export function restingCountText(rows, figure) {
  if (figure.seriesNouns === undefined) {
    return `${formatCount(restingRowCount(rows, figure))} rows`;
  }
  const counts = new Map(binCounts(rows, figure.binColumn).map((bin) => [bin.name, bin.count]));
  const parts = [];
  for (const [series, noun] of Object.entries(figure.seriesNouns)) {
    if (counts.has(series)) {
      parts.push(`${formatCount(counts.get(series))} ${noun}`);
    }
  }
  return parts.length > 0 ? parts.join(" · ") : "0 rows";
}

/**
 * The weeks (Sundays) of `weekEntries` (the entries of `weeks.json`) that the cache simulation does not cover, for a
 * figure drawn from the simulation, wholly or in one column (`isSimulation`); none for any other figure.
 */
export function unsimulatedWeeks(figure, weekEntries) {
  if (figure.isSimulation !== true) {
    return [];
  }
  return weekEntries.filter((entry) => !entry.simulated).map((entry) => entry.week);
}

/**
 * A figure's line of rows, shown with its definition: the rows it rests on, the weeks `notSimulated`, and how many bins
 * were hidden: "1,234 rows · not simulated: 2026-08-16 · 2 bins hidden (fewer than 50 rows each)".
 */
export function figureRowsText(figure, shownRows, hidden, notSimulated) {
  const parts = [restingCountText(shownRows, figure)];
  if (notSimulated.length > 0) {
    parts.push(`not simulated: ${notSimulated.join(", ")}`);
  }
  const hiddenNote = hiddenText(hidden, figure.binColumn);
  if (hiddenNote !== "") {
    parts.push(hiddenNote);
  }
  return parts.join(" · ");
}

/** The note on hidden bins: "2 bins hidden (fewer than 50 rows each)"; "" when none is hidden. */
export function hiddenText(hidden, binColumn) {
  if (hidden === 0) {
    return "";
  }
  const [singular, plural] = HIDDEN_NOUNS[binColumn] ?? DEFAULT_HIDDEN_NOUN;
  const noun = hidden === 1 ? singular : plural;
  return `${hidden} ${noun} hidden (fewer than ${MIN_ROWS_PER_BIN} rows each)`;
}

// Each bin's name and count, `[{ name, count }]`, in the order the bins first appear in the rows.
function binCounts(rows, binColumn) {
  const counts = new Map();
  for (let index = 0; index < rows.length; index += 1) {
    counts.set(binName(rows[index], index, binColumn), rows[index][COUNT_COLUMN]);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}

// The name of the bin a row belongs to: its value in the bin column, or its own position when there is none.
function binName(row, index, binColumn) {
  return binColumn === null ? index : row[binColumn];
}
