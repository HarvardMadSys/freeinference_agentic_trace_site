/**
 * The histogram kind: the bins a query computed, every bin shown, and above them one line of the exact median, 95th
 * percentile and, where asked, the maximum, which a second query, its stats query, computed.
 *
 * Its rows are a bins query's: one bin per row, `bin_start`, `bin_end` and `rows`, how many rows (requests or
 * sessions) fall in it. Its stats query's one row holds `count`, `max` and the percentiles `p50` to `p95`; the kind
 * reads it by name, and `histogramCard` joins the two with the parameters into a card,
 * `{ ...parameters, bins, percentiles, count, max }`, which the drawing reads. The count is also the figure's line of
 * rows, which the kind writes.
 */

import { AXIS_STYLE, BAR_INSET, chartFrame, GRID_STYLE, legendPlace, rowsPlace, X_INSET } from "../shared/charts.js";
import { readAnswer } from "../shared/answers.js";
import { axisWithTicks, extent, logAxisTicks, MAX_TICKS, TICK_COUNT, tickCountFor } from "../axes/ticks.js";
import { formatCount, formatCountTick } from "../shared/format.js";

// The columns of a bins query's rows: where a bin starts, where it ends, and how many rows (requests or
// sessions, as the card counts) fall in it.
const BIN_START_COLUMN = "bin_start";
const BIN_END_COLUMN = "bin_end";
const BIN_COUNT_COLUMN = "rows";

// A card's chart differs from the shared frame in one margin: room left of it for a compact count, less than a share.
const CARD_FRAME = Object.freeze({ marginLeft: 64 });

/**
 * The line above the chart: the median and the 95th percentile in the card's format, then the maximum where the card
 * shows it: "median 0 · p95 1 · max 40"; "" for a card with no rows.
 */
export function summaryText(card) {
  if (card.count === 0) {
    return "";
  }
  const parts = [`median ${card.valueFormat(card.percentiles.p50)}`, `p95 ${card.valueFormat(card.percentiles.p95)}`];
  if (card.showsMaximum) {
    parts.push(`max ${card.valueFormat(card.max)}`);
  }
  return parts.join(" · ");
}

/** The card's line of rows, shown with its definition: "1,125,604 requests". */
export function rowsText(card) {
  const noun = card.countLabel.toLowerCase();
  return `${formatCount(card.count)} ${noun}`;
}

/**
 * The ticks of the card's x axis over the bins it draws, at most `maxTicks` of them: its own `ticks`, else a log axis's
 * powers of ten.
 */
export function cardTicks(card, maxTicks = MAX_TICKS) {
  const bins = drawableBins(card);
  if (!card.logScale || bins.length === 0) {
    return undefined;
  }
  const domain = extent([...bins.map((bin) => bin.x0), ...bins.map((bin) => bin.x1)]);
  return card.ticks === undefined ? logAxisTicks(domain, maxTicks) : card.ticks(domain, maxTicks);
}

/** The histogram card of `parameters`, its bins query's rows and its stats query's one row, as the drawing reads it. */
export function histogramCard(parameters, binRows, statsRow) {
  return {
    ...parameters,
    bins: binsFromRows(binRows),
    percentiles: { p50: statsRow.p50, p95: statsRow.p95 },
    count: statsRow.count,
    max: statsRow.max,
  };
}

/** The bins `{ x0, x1, count }` of a histogram's bins query's rows, in the rows' order. */
export function binsFromRows(rows) {
  return rows.map((row) => ({
    x0: row[BIN_START_COLUMN],
    x1: row[BIN_END_COLUMN],
    count: row[BIN_COUNT_COLUMN],
  }));
}

/**
 * The bins a card's chart draws: every bin on a linear scale; on a log scale only those starting above 0, since a
 * log axis has no place for 0 and an undrawn bin must not stretch the count axis. The line of rows still counts every row.
 */
export function drawableBins(card) {
  return card.logScale ? card.bins.filter((bin) => bin.x0 > 0) : card.bins;
}

/**
 * Draw `rows`, a bins query's, into `body` as a histogram, its summary line in the figure's legend place above it and
 * its count as the figure's line of rows. It takes no series colours and hides no series. Its named parameters:
 * - `statsQuery`: the query whose one row holds the count, the maximum and the percentiles, read here by name.
 * - `countLabel`: what a bin counts, "Sessions": the count axis's title and the line of rows' noun.
 * - `xLabel`: the value axis's title, none when null.
 * - `valueFormat`: how a value is written in the summary and the tooltip; `xTickFormat`: on the value axis.
 * - `logScale`: whether the value axis is a log one; `logCounts`: whether the count axis is.
 * - `showsMaximum`: whether the summary ends with the maximum.
 * - `ticks(domain, maxTicks)`: at most `maxTicks` of a log value axis's ticks over its `[low, high]`; else its powers
 *   of ten.
 */
export async function drawHistogram(rows, body, colours, parameters) {
  const [statsRow] = await readAnswer(parameters.statsQuery);
  const card = histogramCard(parameters, rows, statsRow);
  rowsPlace(body).textContent = rowsText(card);
  if (card.count === 0) {
    body.replaceChildren(emptyNote());
    return;
  }
  const summary = document.createElement("span");
  summary.className = "legend-item";
  summary.textContent = summaryText(card);
  legendPlace(body).replaceChildren(summary);
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  body.replaceChildren(histogramChart(Plot, card, body));
}

function histogramChart(Plot, card, body) {
  const frame = chartFrame(body);
  const ticks = cardTicks(card, tickCountFor(frame.width, MAX_TICKS));
  const counts = countAxis(card);
  return Plot.plot({
    ...frame,
    ...CARD_FRAME,
    x: { type: card.logScale ? "log" : "linear", inset: X_INSET },
    y: { type: counts.type, domain: counts.domain },
    marks: [
      Plot.gridY({ ...GRID_STYLE, ticks: counts.ticks }),
      axisWithTicks(Plot.axisX, ticks, {
        ...AXIS_STYLE, tickFormat: card.xTickFormat, label: card.xLabel,
      }),
      Plot.axisY({ ...AXIS_STYLE, ticks: counts.ticks, tickFormat: formatCountTick, label: card.countLabel }),
      Plot.rectY(drawableBins(card), {
        x1: "x0", x2: "x1", y1: counts.base, y2: "count", fill: "var(--series-1)", inset: BAR_INSET,
      }),
      Plot.ruleY([counts.base], AXIS_STYLE),
      Plot.tip(drawableBins(card), Plot.pointerX({
        x1: "x0", x2: "x1", y: "count", title: (bin) => binDescription(card, bin),
      })),
    ],
  });
}

/**
 * The count axis of `card`: `{ type, domain, base, ticks }`, linear from 0 with about `TICK_COUNT` ticks, or, where the
 * card's counts span many powers of ten, a log axis from the power of ten below its smallest bin to the one above its
 * largest, ticked at its powers of ten, so a bin of a thousand rows beside one of a million still shows.
 */
export function countAxis(card) {
  if (!card.logCounts) {
    return { type: "linear", domain: undefined, base: 0, ticks: TICK_COUNT };
  }
  const counts = drawableBins(card).map((bin) => bin.count);
  const base = 10 ** Math.floor(Math.log10(Math.min(...counts)));
  const top = 10 ** Math.ceil(Math.log10(Math.max(...counts)));
  return { type: "log", domain: [base, top], base, ticks: logAxisTicks([base, top]) };
}

function binDescription(card, bin) {
  return `${card.valueFormat(bin.x0)} – ${card.valueFormat(bin.x1)}\n${card.countLabel}: ${formatCount(bin.count)}`;
}

function emptyNote() {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "No rows in any week from the paper's harnesses.";
  return note;
}
