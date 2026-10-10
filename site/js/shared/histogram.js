/**
 * The distribution card: a histogram of the bins a query computed, with dashed lines at its exact percentiles.
 *
 * The card runs no query. It is given the bins on the card's fixed scale,
 * the percentiles, the row count and the maximum, and draws them.
 */

import { AXIS_STYLE, chartFrame, DASH, GRID_STYLE, renderFigure } from "./charts.js";
import { formatCount } from "./format.js";

// The columns of a distribution query's rows: where a bin starts, where it ends, and how many rows (requests or
// sessions, as the card counts) fall in it.
const BIN_START_COLUMN = "bin_start";
const BIN_END_COLUMN = "bin_end";
const BIN_COUNT_COLUMN = "rows";

// The percentiles drawn as dashed lines, each in the colour it has on every card.
// Neighbouring percentiles put their labels on alternate rows, so two close lines keep readable labels.
const PERCENTILE_LINES = [
  { percentile: "p50", colour: "var(--series-1)", labelRow: 0 },
  { percentile: "p75", colour: "var(--series-3)", labelRow: 1 },
  { percentile: "p90", colour: "var(--series-4)", labelRow: 0 },
  { percentile: "p95", colour: "var(--series-8)", labelRow: 1 },
];

// A card's chart differs from the shared frame in these: a lower chart, room above it for two rows of percentile
// labels, room left of it for a count of seven digits with its separators, and less below it.
const CARD_FRAME = Object.freeze({ height: 220, marginTop: 32, marginLeft: 60, marginBottom: 28 });
const BAR_INSET = 1; // pixels taken off each side of a bar: a 2px gap between neighbouring bars
const PERCENTILE_HALO_WIDTH = 4; // a surface-coloured line under each dashed line, so it shows over a bar of its own colour
const PERCENTILE_LINE_WIDTH = 2; // pixels; thin lines, as every chart draws them
const LABEL_GAP = 4; // pixels between the top of the chart and the lower row of percentile labels
const LABEL_ROW_HEIGHT = 11; // pixels between the two rows of percentile labels above the chart
const DEFAULT_COUNT_LABEL = "Rows"; // the y axis label when the card does not name what it counts

/** The line under a card's title: "n = 1,186,582 · p50 129.1k · p90 512.3k · max 2M"; just "n = 0" for no rows. */
export function subtitle(card) {
  if (card.count === 0) {
    return "n = 0";
  }
  const { p50, p90 } = card.percentiles;
  return `n = ${formatCount(card.count)} · p50 ${card.format(p50)} · p90 ${card.format(p90)} · max ${card.format(card.max)}`;
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
 * log axis has no place for 0 and an undrawn bin must not stretch the count axis. The subtitle still counts every row.
 */
export function drawableBins(card) {
  return card.logScale ? card.bins.filter((bin) => bin.x0 > 0) : card.bins;
}

/** Draw the distribution card into `container`, replacing what it held. */
export async function mountHistogram(container, card) {
  const definition = card.logScale ? `${card.definition} Log scale.` : card.definition;
  const body = renderFigure(container, { title: card.title, definition, caption: subtitle(card) });
  if (card.count === 0) {
    body.append(emptyNote());
    return;
  }
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("./libraries.js");
  body.append(histogramChart(Plot, card, body));
  body.after(percentileLegend());
}

function histogramChart(Plot, card, body) {
  const countLabel = card.countLabel ?? DEFAULT_COUNT_LABEL;
  return Plot.plot({
    ...chartFrame(body),
    ...CARD_FRAME,
    x: { type: card.logScale ? "log" : "linear" },
    y: { label: countLabel },
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.axisX({ ...AXIS_STYLE, tickFormat: card.format, label: null }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatCount }),
      Plot.rectY(drawableBins(card), { x1: "x0", x2: "x1", y: "count", fill: "var(--series-1)", inset: BAR_INSET }),
      Plot.ruleY([0], AXIS_STYLE),
      ...percentileMarks(Plot, card),
      Plot.tip(drawableBins(card), Plot.pointerX({ x1: "x0", x2: "x1", y: "count", title: (bin) => binDescription(card, bin, countLabel) })),
    ],
  });
}

function percentileMarks(Plot, card) {
  const marks = [];
  for (const line of PERCENTILE_LINES) {
    const position = [{ value: card.percentiles[line.percentile], label: line.percentile }];
    const labelOffset = -LABEL_GAP - line.labelRow * LABEL_ROW_HEIGHT;
    marks.push(Plot.ruleX(position, { x: "value", stroke: "var(--color-surface)", strokeWidth: PERCENTILE_HALO_WIDTH }));
    marks.push(Plot.ruleX(position, { x: "value", stroke: line.colour, strokeWidth: PERCENTILE_LINE_WIDTH, strokeDasharray: DASH }));
    marks.push(Plot.text(position, { x: "value", text: "label", frameAnchor: "top", lineAnchor: "bottom", dy: labelOffset }));
  }
  return marks;
}

function binDescription(card, bin, countLabel) {
  return `${card.format(bin.x0)} – ${card.format(bin.x1)}\n${countLabel}: ${formatCount(bin.count)}`;
}

function percentileLegend() {
  const legend = document.createElement("p");
  legend.className = "legend";
  for (const line of PERCENTILE_LINES) {
    const item = document.createElement("span");
    item.className = "legend-item";
    item.innerHTML = `<svg class="legend-dash" viewBox="0 0 18 8" aria-hidden="true">
      <line x1="0" y1="4" x2="18" y2="4" stroke="${line.colour}" stroke-width="2" stroke-dasharray="${DASH}" />
    </svg>`;
    item.append(line.percentile);
    legend.append(item);
  }
  return legend;
}

function emptyNote() {
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = "No rows in the selected weeks and scope.";
  return note;
}
