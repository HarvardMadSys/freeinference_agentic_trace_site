/**
 * The distribution card: a histogram of the bins a query computed, with dashed lines at its exact percentiles, whose
 * legend gives their values and the maximum.
 *
 * The card runs no query. It is given the bins on the card's fixed scale, the percentiles, the row count and the
 * maximum, and draws them. A card is `{ title, caption, definition, countLabel, format, logScale, tickFormat, ticks,
 * bins, percentiles, count, max }`: `format` writes a value in the legend and the tooltip, `tickFormat` (else
 * `format`) on the axis, and `ticks(domain, maxTicks)`, when given, picks at most `maxTicks` of a log axis's ticks over
 * its `[low, high]`.
 */

import { AXIS_STYLE, chartFrame, DASH, GRID_STYLE, legendPlace, renderFigure, TIP_STYLE, X_INSET } from "./charts.js";
import { axisWithTicks, extent, logAxisTicks, MAX_TICKS, maxTicksFor, TICK_COUNT } from "../axes/ticks.js";
import { formatCompactCount, formatCount } from "./format.js";

// The columns of a distribution query's rows: where a bin starts, where it ends, and how many rows (requests or
// sessions, as the card counts) fall in it.
const BIN_START_COLUMN = "bin_start";
const BIN_END_COLUMN = "bin_end";
const BIN_COUNT_COLUMN = "rows";

// The percentiles drawn as dashed lines, each in the colour it has on every card.
const PERCENTILE_LINES = [
  { percentile: "p50", colour: "var(--series-1)" },
  { percentile: "p75", colour: "var(--series-3)" },
  { percentile: "p90", colour: "var(--series-4)" },
  { percentile: "p95", colour: "var(--series-8)" },
];

// A card's chart differs from the shared frame in one margin: room left of it for a compact count, less than a share.
const CARD_FRAME = Object.freeze({ marginLeft: 64 });
const BAR_INSET = 1; // pixels taken off each side of a bar: a 2px gap between neighbouring bars
const PERCENTILE_HALO_WIDTH = 4; // a surface-coloured line under each dashed line, so it shows over a bar of its own colour
const PERCENTILE_LINE_WIDTH = 2; // pixels; thin lines, as every chart draws them
const DEFAULT_COUNT_LABEL = "Rows"; // the y axis label when the card does not name what it counts

/**
 * The legend's entries: `[{ colour, text }]`, each percentile's dashed line as "p50 129.1k" in the card's format,
 * none for a card with no rows.
 */
export function percentileEntries(card) {
  if (card.count === 0) {
    return [];
  }
  return PERCENTILE_LINES.map((line) => ({
    colour: line.colour,
    text: `${line.percentile} ${card.format(card.percentiles[line.percentile])}`,
  }));
}

/** The legend's last entry, the card's maximum: "max 1.8M"; "" for a card with no rows. */
export function maximumText(card) {
  return card.count === 0 ? "" : `max ${card.format(card.max)}`;
}

/** The card's line of rows, shown with its definition: "1,125,604 requests". */
export function rowsText(card) {
  const noun = (card.countLabel ?? DEFAULT_COUNT_LABEL).toLowerCase();
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

/** The bins `{ x0, x1, count }` of a distribution query's rows, in the rows' order. */
export function binsFromRows(rows) {
  // DuckDB returns 64-bit integers as BigInt, which Plot's scales do not accept.
  return rows.map((row) => ({
    x0: Number(row[BIN_START_COLUMN]),
    x1: Number(row[BIN_END_COLUMN]),
    count: Number(row[BIN_COUNT_COLUMN]),
  }));
}

/**
 * The bins a card's chart draws: every bin on a linear scale; on a log scale only those starting above 0, since a
 * log axis has no place for 0 and an undrawn bin must not stretch the count axis. The line of rows still counts every row.
 */
export function drawableBins(card) {
  return card.logScale ? card.bins.filter((bin) => bin.x0 > 0) : card.bins;
}

/** Draw the distribution card into `container`, replacing what it held: legend above the chart. */
export async function mountHistogram(container, card) {
  const body = renderFigure(container, {
    title: card.title, caption: card.caption, definition: card.definition, rows: rowsText(card),
  });
  if (card.count === 0) {
    body.append(emptyNote());
    return;
  }
  legendPlace(body).replaceChildren(...percentileLegendItems(card));
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  body.append(histogramChart(Plot, card, body));
}

function histogramChart(Plot, card, body) {
  const countLabel = card.countLabel ?? DEFAULT_COUNT_LABEL;
  const frame = chartFrame(body);
  const ticks = cardTicks(card, maxTicksFor(frame.width));
  return Plot.plot({
    ...frame,
    ...CARD_FRAME,
    x: { type: card.logScale ? "log" : "linear", inset: X_INSET },
    marks: [
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      axisWithTicks(Plot.axisX, ticks, { ...AXIS_STYLE, tickFormat: card.tickFormat ?? card.format, label: null }),
      Plot.axisY({ ...AXIS_STYLE, ticks: TICK_COUNT, tickFormat: formatCompactCount, label: countLabel }),
      Plot.rectY(drawableBins(card), { x1: "x0", x2: "x1", y: "count", fill: "var(--series-1)", inset: BAR_INSET }),
      Plot.ruleY([0], AXIS_STYLE),
      ...percentileMarks(Plot, card),
      Plot.tip(drawableBins(card), Plot.pointerX({
        ...TIP_STYLE, x1: "x0", x2: "x1", y: "count", title: (bin) => binDescription(card, bin, countLabel),
      })),
    ],
  });
}

function percentileMarks(Plot, card) {
  const marks = [];
  for (const line of PERCENTILE_LINES) {
    const position = [card.percentiles[line.percentile]];
    marks.push(Plot.ruleX(position, { stroke: "var(--color-surface)", strokeWidth: PERCENTILE_HALO_WIDTH }));
    marks.push(Plot.ruleX(position, { stroke: line.colour, strokeWidth: PERCENTILE_LINE_WIDTH, strokeDasharray: DASH }));
  }
  return marks;
}

function binDescription(card, bin, countLabel) {
  return `${card.format(bin.x0)} – ${card.format(bin.x1)}\n${countLabel}: ${formatCount(bin.count)}`;
}

// The legend's items: a dashed line and its value per percentile, then the maximum.
function percentileLegendItems(card) {
  const items = [];
  for (const entry of percentileEntries(card)) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<svg class="legend-dash" viewBox="0 0 18 8" aria-hidden="true">
      <line x1="0" y1="4" x2="18" y2="4" stroke="${entry.colour}" stroke-width="2" stroke-dasharray="${DASH}" />
    </svg>`;
    item.append(entry.text);
    items.push(item);
  }
  const maximum = document.createElement("span");
  maximum.className = "legend-item";
  maximum.textContent = maximumText(card);
  items.push(maximum);
  return items;
}

function emptyNote() {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "No rows in the selected weeks and harnesses.";
  return note;
}
