/**
 * The Prefix-caching section of the Explore page's figures: how much of a request's input the provider served from
 * cache, after a gap of each length and cause, after an idle gap and after each kind of context change, and what the
 * cache simulation says each TTL prefills, keeps and costs. The figures of the gap or change before a request are drawn in
 * `caching_gaps.js`, those of the simulation in `simulation/prefill.js` and `simulation/costs.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. A figure of more than one series colours each
 * from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, LINE_WIDTH, X_INSET } from "../shared/charts.js";
import { axisWithTicks } from "../axes/ticks.js";
import { slottedColours } from "../theme/colours.js";
import { formatCount, formatDurationTick, formatPercent, formatSeconds, formatShare } from "../shared/format.js";
import { GAP_FIGURES } from "./caching_gaps.js";
import { API_COST_BY_TTL, INFRASTRUCTURE_COST_BY_TTL } from "../simulation/costs.js";
import { PREFILL_AGAINST_STORAGE } from "../simulation/prefill.js";
import { rowsWithSeriesColour } from "./figure_rows.js";
import { seriesLegend } from "../shared/series.js";

// The idle-gap bins mirror the pipeline's `gaps.IDLE_GAP_EDGES_S`: 26 bins between 27 geometric edges from 10 s to
// one hour, each 1.25 times as wide as the one before. tests/test_pipeline_mirrors.py checks these three constants
// against the pipeline.
const FIRST_IDLE_GAP_EDGE_S = 10;
const LAST_IDLE_GAP_EDGE_S = 3600;
const IDLE_GAP_BINS = 26;
// The idle gaps the axis marks, in seconds: 10 s, a minute, ten minutes and an hour, about a decade apart, so their
// labels have room on a phone.
const IDLE_GAP_TICK_SECONDS = Object.freeze([10, 60, 600, 3600]);

const MARKER_RADIUS = 3; // pixels; the small markers on the idle-gap lines

/** The Prefix-caching topic's takeaway, one sentence under its heading: the paper's finding in plain words. */
export const TAKEAWAY = "Long waits and changes to earlier messages reduce cache hits.";

/** The figures of the Prefix-caching section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  GAP_FIGURES.hitRatioByGapBin,
  Object.freeze({
    name: "hit_ratio_by_idle_gap",
    title: "Cache reuse by provider",
    insight: "The same pause can be a cache hit on one provider and a miss on another.",
    definition: "The median percentage of input tokens read from cache, grouped by time since the same user’s previous request ended. Each line shows one of the eight busiest providers, labeled with a letter. Wait times range from 10 seconds to one hour.",
    caption: "One provider's median cache-hit ratio falls below 50% after 15 minutes, while another maintains high reuse near one hour, revealing substantial differences in cache retention.",
    drawsLines: true,
    query: "figures/hit_ratio_by_idle_gap",
    binColumn: null,
    seriesColumn: "provider",
    drawnRows: (rows, colours) => rowsWithSeriesColour(rows, "provider", colours.providers),
    legend: idleGapLegend,
    draw: drawIdleGapRetention,
  }),
  GAP_FIGURES.gapByCause,
  GAP_FIGURES.meanHitRatioByCause,
  GAP_FIGURES.hitRatioByTransition,
  GAP_FIGURES.mutationsByCause,
  PREFILL_AGAINST_STORAGE,
  API_COST_BY_TTL,
  INFRASTRUCTURE_COST_BY_TTL,
]);

/** An idle-gap edge in seconds: edge 0 is 10 s and edge 26 one hour; a fractional edge lies between, geometrically. */
export function idleGapEdgeSeconds(edge) {
  return FIRST_IDLE_GAP_EDGE_S * (LAST_IDLE_GAP_EDGE_S / FIRST_IDLE_GAP_EDGE_S) ** (edge / IDLE_GAP_BINS);
}

/**
 * The idle-gap figure's legend: each provider of the rows among the eight with most requests as "Provider A", in the
 * order of their letters and in the colours every chart shares, from an order over every week and harness.
 * A provider past the eighth would take the Other colour, which a named line cannot share, so it is not drawn.
 */
export function idleGapLegend(rows, colours, seriesColumn) {
  const slotted = slottedColours(colours.providers);
  const drawnColours = new Map();
  const labels = {};
  for (const provider of [...slotted.keys()].sort()) {
    drawnColours.set(provider, slotted.get(provider));
    labels[provider] = providerLabel(provider);
  }
  return seriesLegend(rows, seriesColumn, drawnColours, labels);
}

/** Draw one line per provider of the rows, its median hit ratio per idle-gap bin, on a log axis of seconds. */
async function drawIdleGapRetention(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const points = rows.map((row) => ({
    provider: row.provider,
    seconds: idleGapEdgeSeconds(row.idle_gap_bin + 0.5), // the bin's geometric middle
    hitRatio: row.median_hit_ratio,
    row,
  }));
  const present = new Set(rows.map((row) => row.provider));
  const providers = [...colours.series.keys()].filter((provider) => present.has(provider));
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [FIRST_IDLE_GAP_EDGE_S, LAST_IDLE_GAP_EDGE_S], inset: X_INSET },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, providers),
    marks: [
      Plot.gridX(IDLE_GAP_TICK_SECONDS, GRID_STYLE),
      Plot.gridY(GRID_STYLE),
      axisWithTicks(Plot.axisX, IDLE_GAP_TICK_SECONDS, {
        ...AXIS_STYLE, label: "Idle gap", tickFormat: formatDurationTick,
      }),
      Plot.axisY({ ...AXIS_STYLE, label: "Median hit ratio", tickFormat: formatPercent }),
      Plot.line(points, { x: "seconds", y: "hitRatio", stroke: "provider", strokeWidth: LINE_WIDTH }),
      Plot.dot(points, { x: "seconds", y: "hitRatio", fill: "provider", r: MARKER_RADIUS }),
      Plot.tip(points, Plot.pointer({ x: "seconds", y: "hitRatio", title: idleGapTipText })),
    ],
  });
  body.replaceChildren(chart);
}

function providerLabel(provider) {
  return `Provider ${provider}`;
}

function idleGapTipText(point) {
  const bin = point.row.idle_gap_bin;
  const from = bin === 0 ? "up" : formatSeconds(idleGapEdgeSeconds(bin));
  const gap = `${from} to ${formatSeconds(idleGapEdgeSeconds(bin + 1))} idle`;
  const requests = `${formatCount(point.row.rows)} requests`;
  return `${providerLabel(point.provider)}\n${gap}\nmedian hit ratio ${formatShare(point.hitRatio)}\n${requests}`;
}
