/**
 * What the Paper figures page does to a figure's rows before drawing them: thin bins hidden, the caption's row
 * count, scope, weeks and note on hidden bins, a CDF query's points grouped into series, and the labels of a crowded
 * axis.
 *
 * A figure's rows belong to bins: the rows sharing the value of the figure's `binColumn` (a size bin, a week, or
 * a CDF series). Every row of a bin carries the bin's count, the number of rows of the data it rests on, in the
 * column `rows`. These are plain functions, tested with `node --test`.
 */

import { dropThinBins, MIN_ROWS_PER_BIN } from "../shared/charts.js";
import { formatCount } from "../shared/format.js";

// The column of every figure query that holds a bin's count: the number of rows of the data behind the bin.
const COUNT_COLUMN = "rows";

// What a hidden bin is called in the caption, singular and plural, by the figure's bin column; any other is a "bin".
const HIDDEN_NOUNS = Object.freeze({
  series: ["series", "series"],
  week: ["week", "weeks"],
});
const DEFAULT_HIDDEN_NOUN = ["bin", "bins"];

/**
 * `{ rows, hidden }`: the rows of the bins whose count is at least `MIN_ROWS_PER_BIN`, in their order, and how
 * many bins were hidden.
 */
export function dropThinGroups(rows, binColumn) {
  const { rows: keptBins, hidden } = dropThinBins(binCounts(rows, binColumn), "count");
  const keptNames = new Set(keptBins.map((bin) => bin.name));
  return { rows: rows.filter((row) => keptNames.has(row[binColumn])), hidden };
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
 * The series of a CDF query's rows `{ series, x, share }`, in the order of `names` (series names in the rows), as
 * `[{ name, points: [{ x, share }] }]`; a series is drawn under `labels[name]` when given, else under its own name.
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
      series.push({ name: Object.hasOwn(labels, name) ? labels[name] : name, points });
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
  for (const row of rows) {
    counts.set(row[binColumn], row[COUNT_COLUMN]);
  }
  return [...counts].map(([name, count]) => ({ name, count }));
}
