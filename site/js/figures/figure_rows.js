/**
 * What the Explore page does to a figure's rows before drawing them: the rows it draws, thin bins hidden, its
 * caption (the rows it rests on, its harnesses and weeks, the weeks not simulated and the bins hidden), the series its
 * legend lists, a CDF query's points grouped into series, and the labels of a crowded axis or a log one.
 *
 * A figure's rows belong to bins: the rows sharing the value of the figure's `binColumn` (a size bin, a week, or
 * a CDF series), or, when `binColumn` is null, each row alone. Every row of a bin carries the bin's count, the number
 * of rows of the data it rests on, in the column `rows`. These are plain functions, tested with `node --test`.
 */

import { dropThinBins, MIN_ROWS_PER_BIN, weeksText } from "../shared/charts.js";
import { formatCount } from "../shared/format.js";
import { harnessesText, isDefaultHarnessChoice } from "../shared/selection.js";

/** How a log axis writes its ticks: 0.1 and 1000, not Plot's SI "100m" (which reads as minutes) and "1k". */
export const PLAIN_NUMBER_FORMAT = "~g";

// The column of every figure query that holds a bin's count: the number of rows of the data behind the bin.
const COUNT_COLUMN = "rows";

// What a hidden bin is called in the caption, singular and plural, by the figure's bin column; any other is a "bin".
const HIDDEN_NOUNS = Object.freeze({
  series: ["series", "series"],
  week: ["week", "weeks"],
  category: ["category", "categories"],
  policy: ["policy", "policies"],
});
const DEFAULT_HIDDEN_NOUN = ["bin", "bins"];

// What a simulation figure's caption names while other than the paper's harnesses are selected: the simulation
// replays the paper's population only, so the figure draws it whatever harnesses are selected.
const SIMULATED_HARNESSES_TEXT = "the paper's harnesses only, which the simulation replays";

/**
 * The rows of a query's `rows` that `figure` draws: those its `drawnRows(rows, colours)` keeps, given the colours every
 * figure shares, or every row for a figure without one. The caption counts these rows and their thin bins are hidden.
 */
export function figureDrawnRows(figure, rows, colours) {
  return figure.drawnRows === undefined ? rows : figure.drawnRows(rows, colours);
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
 * The caption's count of the rows a figure rests on: "1,234 rows", or, for a figure whose series count different
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
 * `{ harnesses, weeks, notSimulated }`: the text naming the harnesses a figure's rows come from, the weeks (Sundays)
 * they come from, and the selected weeks they leave out because the simulation does not cover them. That is the
 * selection's, by `harnessEntries` (the entries of `harnesses.json`), with no week left out, except for a simulation
 * figure (`isSimulation`), whose rows are the paper's harnesses' in the selected weeks the simulation covers, by
 * `weekEntries` (the entries of `weeks.json`); its text then says so when other harnesses are selected.
 */
export function drawnHarnessesAndWeeks(figure, selection, weekEntries, harnessEntries) {
  const selectedText = harnessesText(selection.harnesses, harnessEntries);
  if (figure.isSimulation !== true) {
    return { harnesses: selectedText, weeks: selection.weeks, notSimulated: [] };
  }
  const simulated = new Set(weekEntries.filter((entry) => entry.simulated).map((entry) => entry.week));
  const weeks = selection.weeks.filter((week) => simulated.has(week));
  const notSimulated = selection.weeks.filter((week) => !simulated.has(week));
  if (isDefaultHarnessChoice(selection.harnesses, harnessEntries)) {
    return { harnesses: selectedText, weeks, notSimulated };
  }
  return { harnesses: SIMULATED_HARNESSES_TEXT, weeks, notSimulated };
}

/**
 * A figure's caption: the rows it rests on, the harnesses and weeks they come from (`drawn`, as
 * `drawnHarnessesAndWeeks` gives them), the selected weeks the simulation does not cover, and how many bins were hidden:
 * "1,234 rows · the paper's harnesses · 15 weeks · not simulated: 2026-08-16".
 */
export function figureCaption(figure, shownRows, hidden, drawn) {
  const parts = [restingCountText(shownRows, figure), drawn.harnesses, weeksText(drawn.weeks)];
  if (drawn.notSimulated.length > 0) {
    parts.push(`not simulated: ${drawn.notSimulated.join(", ")}`);
  }
  const hiddenNote = hiddenText(hidden, figure.binColumn);
  if (hiddenNote !== "") {
    parts.push(hiddenNote);
  }
  return parts.join(" · ");
}

/** The caption's note on hidden bins: "2 bins hidden (fewer than 50 rows each)"; "" when none is hidden. */
export function hiddenText(hidden, binColumn) {
  if (hidden === 0) {
    return "";
  }
  const [singular, plural] = HIDDEN_NOUNS[binColumn] ?? DEFAULT_HIDDEN_NOUN;
  const noun = hidden === 1 ? singular : plural;
  return `${hidden} ${noun} hidden (fewer than ${MIN_ROWS_PER_BIN} rows each)`;
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

/**
 * The series of a CDF query's rows `{ series, x, share }`, in the order of `names` (series names in the rows), as
 * `[{ name, label, points: [{ x, share }] }]`; a series' label is `labels[name]` when given, else its name.
 * A series with no rows is left out. An `x` below `floor` is drawn at `floor`, so a zero has a place on a log axis.
 */
export function cdfSeries(rows, names, { labels = {}, floor = -Infinity } = {}) {
  const series = [];
  for (const name of names) {
    const points = [];
    for (const row of rows) {
      if (row.series === name) {
        points.push({ x: Math.max(row.x, floor), share: row.share });
      }
    }
    if (points.length > 0) {
      series.push({ name, label: Object.hasOwn(labels, name) ? labels[name] : name, points });
    }
  }
  return series;
}

/**
 * A tick format for a crowded band axis: `format(value)` for every `step`-th of `values` (in axis order, first
 * included), the step chosen so at most `maxLabels` are written, and "" for the rest.
 */
export function sparseTickFormat(values, format, maxLabels) {
  const step = Math.max(1, Math.ceil(values.length / maxLabels));
  const labelled = new Set(values.filter((value, index) => index % step === 0));
  return (value) => (labelled.has(value) ? format(value) : "");
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
