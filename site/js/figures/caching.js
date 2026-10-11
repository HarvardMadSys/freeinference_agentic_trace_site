/**
 * The Prefix-caching section of the Explore page's figures: how much of a request's input the provider served from
 * cache, after a gap of each length and cause, after an idle gap and after each kind of context change, and what the
 * cache simulation says each TTL and eviction policy would keep. The figures of the gap or change before a request are
 * drawn in `caching_gaps.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines; a figure that `isSimulation` draws
 * the simulation of the paper's harnesses whatever harnesses are selected. A figure of more than one series colours
 * each from its legend's colours, `colours.series`, so its chart and its legend agree whichever series are hidden.
 */

import {
  AXIS_STYLE, assignColours, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, SERIES_SLOTS,
  TIP_STYLE,
} from "../shared/charts.js";
import { formatCount, formatSeconds, formatShare } from "../shared/format.js";
import { GAP_FIGURES } from "./caching_gaps.js";
import { seriesLegend, sparseTickFormat } from "./figure_rows.js";

// The idle-gap bins mirror the pipeline's `gaps.IDLE_GAP_EDGES_S`: 26 bins between 27 geometric edges from 10 s to
// one hour, each 1.25 times as wide as the one before. tests/test_pipeline_mirrors.py checks these three constants,
// the TTLs and the policies against the pipeline.
const FIRST_IDLE_GAP_EDGE_S = 10;
const LAST_IDLE_GAP_EDGE_S = 3600;
const IDLE_GAP_BINS = 26;
// The idle gaps the axis marks, in seconds, each with its label.
const IDLE_GAP_TICKS = Object.freeze({ 10: "10s", 60: "1m", 300: "5m", 900: "15m", 3600: "1h" });
const IDLE_GAP_TICK_SECONDS = Object.freeze(Object.keys(IDLE_GAP_TICKS).map(Number));

// The simulated TTLs, shortest first, then no TTL at all, in the order of the pipeline's `cache.TTLS`.
const TTLS = Object.freeze(["1s", "10s", "30s", "1m", "5m", "10m", "15m", "30m", "1h", "3h", "6h", "1d", "none"]);
const NO_TTL_LABEL = "∞"; // how the axis writes the TTL `none`
const TTL_LABEL_SPACING = 28; // pixels per TTL label at least, so a phone's axis labels every other TTL

// The simulated eviction policies, in the order of the pipeline's `cache.POLICIES`, with the name each is drawn under.
const POLICY_NAMES = Object.freeze({
  ttl_only: "TTL only",
  reclaim_mutate: "Reclaim mutate",
  reclaim_dead: "Reclaim dead",
  reclaim_both: "Reclaim both",
});

// The retained-over-active figure's series, by the column of the query each is drawn from, with their names and
// colours: blue for what is read again and red for what is not, as the paper draws them.
const RETAINED_COLUMNS = Object.freeze({ reusable: "reusable_over_active", dead: "dead_over_active" });
const RETAINED_NAMES = Object.freeze({ reusable: "Reusable", dead: "Dead" });
const RETAINED_COLOURS = Object.freeze({ reusable: SERIES_SLOTS[0], dead: SERIES_SLOTS[7] });

const MARKER_RADIUS = 3; // pixels; the small markers on every line of the section
const PLAIN_NUMBER_FORMAT = "~g"; // a log axis writes 0.001 and 100, not Plot's SI "1m" and "100"

/** The figures of the Prefix-caching section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  GAP_FIGURES.hitRatioByGapBin,
  Object.freeze({
    name: "hit_ratio_by_idle_gap",
    title: "Hit ratio after an idle gap",
    definition: "Median hit ratio (cached over input tokens) of requests per bin of idle gap (the time since the same user's previous request at the provider finished; 26 geometric bins from 10 s to 1 h, each drawn at its middle), one line per provider, where the paper merges a bin of fewer than 20 requests into the next, draws it at its requests' median gap and shows the four providers with most idle gaps.",
    query: "figures/hit_ratio_by_idle_gap",
    binColumn: null,
    seriesColumn: "provider",
    legend: idleGapLegend,
    draw: drawIdleGapRetention,
  }),
  GAP_FIGURES.gapByCause,
  GAP_FIGURES.meanHitRatioByCause,
  GAP_FIGURES.hitRatioByTransition,
  Object.freeze({
    name: "simulated_hit_ratio_by_ttl",
    title: "Simulated hit ratio by TTL",
    definition: "Hit tokens over hit and missed tokens in the prefix-cache simulation of the paper's harnesses, whatever harnesses are selected, per cache TTL and eviction policy, where the paper draws the TTL-only policy's misses as prefill against storage.",
    query: "figures/simulated_hit_ratio_by_ttl",
    binColumn: "policy",
    seriesColumn: "policy",
    seriesOverSameRows: true,
    isSimulation: true,
    legend: policyLegend,
    draw: drawSimulatedHitRatios,
  }),
  Object.freeze({
    name: "retained_over_active",
    title: "Retained over active cache",
    definition: "Token-seconds of cached blocks that are read again (reusable) and of those never read again (dead) over those of the blocks requests in flight hold, in the prefix-cache simulation of the paper's harnesses under the TTL-only policy, whatever harnesses are selected, per cache TTL, where the paper draws the TTLs only up to a day.",
    query: "figures/retained_over_active",
    binColumn: "ttl",
    seriesOverSameRows: true,
    isSimulation: true,
    legend: retainedLegend,
    draw: drawRetainedOverActive,
  }),
  Object.freeze({
    name: "dead_over_active_by_policy",
    title: "Dead over active cache by policy",
    definition: "Token-seconds that cached blocks stay after their last read over those of the blocks requests in flight hold, in the prefix-cache simulation of the paper's harnesses, whatever harnesses are selected, per cache TTL and eviction policy, where the paper draws the TTL-only and reclaim-mutate policies only up to a day.",
    query: "figures/dead_over_active_by_policy",
    binColumn: "policy",
    seriesColumn: "policy",
    seriesOverSameRows: true,
    isSimulation: true,
    legend: policyLegend,
    draw: drawDeadOverActive,
  }),
]);

/** An idle-gap edge in seconds: edge 0 is 10 s and edge 26 one hour; a fractional edge lies between, geometrically. */
export function idleGapEdgeSeconds(edge) {
  return FIRST_IDLE_GAP_EDGE_S * (LAST_IDLE_GAP_EDGE_S / FIRST_IDLE_GAP_EDGE_S) ** (edge / IDLE_GAP_BINS);
}

/**
 * The idle-gap figure's legend: each provider of the rows as "Provider A", in the provider order and colours every
 * chart shares, so a provider keeps its colour whatever the selection.
 */
export function idleGapLegend(rows, colours, seriesColumn) {
  const labels = {};
  for (const provider of colours.providers.keys()) {
    labels[provider] = providerLabel(provider);
  }
  return seriesLegend(rows, seriesColumn, colours.providers, labels);
}

/** A simulation figure's legend: the eviction policies, in their order, by the names they are drawn under. */
function policyLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, assignColours(Object.keys(POLICY_NAMES)), POLICY_NAMES);
}

/** Draw one line per provider of its median hit ratio per idle-gap bin, on a log axis of seconds, with markers. */
async function drawIdleGapRetention(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const points = rows.map((row) => ({
    provider: row.provider,
    seconds: idleGapEdgeSeconds(row.idle_gap_bin + 0.5), // the bin's geometric middle
    hitRatio: row.median_hit_ratio,
    row,
  }));
  const providers = [...colours.series.keys()];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [FIRST_IDLE_GAP_EDGE_S, LAST_IDLE_GAP_EDGE_S] },
    y: { domain: [0, 1] },
    color: colourScale(colours.series, providers),
    marks: [
      Plot.gridX({ ...GRID_STYLE, ticks: IDLE_GAP_TICK_SECONDS }),
      Plot.gridY(GRID_STYLE),
      // The labels are given as text: a log axis's own tick format would leave out every tick but 10s, 5m and 1h.
      Plot.axisX(IDLE_GAP_TICK_SECONDS, { ...AXIS_STYLE, label: "Idle gap", text: idleGapTickLabel }),
      Plot.axisY({ ...AXIS_STYLE, label: "Median hit ratio", tickFormat: "%" }),
      Plot.line(points, { x: "seconds", y: "hitRatio", stroke: "provider", strokeWidth: LINE_WIDTH }),
      Plot.dot(points, { x: "seconds", y: "hitRatio", fill: "provider", r: MARKER_RADIUS }),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "seconds", y: "hitRatio", title: idleGapTipText })),
    ],
  });
  body.replaceChildren(chart);
}

/** The retained-over-active figure's legend: reusable, then dead. */
export function retainedLegend() {
  const series = Object.entries(RETAINED_NAMES).map(([name, label]) => ({ name, label }));
  return { series, colours: new Map(Object.entries(RETAINED_COLOURS)) };
}

/** Draw one line per policy of its simulated hit ratio per TTL. */
async function drawSimulatedHitRatios(rows, body, colours) {
  const points = policyPoints(rows, "hit_ratio");
  await drawTtlLines(body, points, colours.series, { names: POLICY_NAMES, yLabel: "Simulated hit ratio", logY: false });
}

/** Draw one line per policy of its dead over active token-seconds per TTL, on a log axis, with a line at one. */
async function drawDeadOverActive(rows, body, colours) {
  const points = policyPoints(rows, "dead_over_active");
  await drawTtlLines(body, points, colours.series, { names: POLICY_NAMES, yLabel: "Dead / active", logY: true });
}

/** Draw the reusable and the dead token-seconds over active ones per TTL, but the `hidden`, on a log axis. */
async function drawRetainedOverActive(rows, body, colours, hidden) {
  const points = retainedPoints(rows, hidden);
  await drawTtlLines(body, points, colours.series, { names: RETAINED_NAMES, yLabel: "Retained / active", logY: true });
}

/**
 * Draw one line per series of `points` (`{ series, ttl, value }`), in the order of `names` (from series to the name it
 * is drawn under) and in its colour from `seriesColours`, over the TTLs in their fixed order, with markers. A share
 * axis runs from 0 to 1; a log axis (`logY`) marks one with a dashed line.
 */
async function drawTtlLines(body, points, seriesColours, { names, yLabel, logY }) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const shown = Object.keys(names).filter((series) => points.some((point) => point.series === series));
  const reference = logY ? [Plot.ruleY([1], { ...AXIS_STYLE, strokeDasharray: DASH })] : [];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "point", domain: TTLS },
    y: logY ? { type: "log" } : { domain: [0, 1] },
    color: colourScale(seriesColours, shown),
    marks: [
      Plot.gridY(GRID_STYLE),
      ...reference,
      Plot.axisX({ ...AXIS_STYLE, label: "Cache TTL", tickFormat: ttlTickFormat(body) }),
      Plot.axisY({ ...AXIS_STYLE, label: yLabel, tickFormat: logY ? PLAIN_NUMBER_FORMAT : "%" }),
      Plot.line(points, { x: "ttl", y: "value", stroke: "series", strokeWidth: LINE_WIDTH }),
      Plot.dot(points, { x: "ttl", y: "value", fill: "series", r: MARKER_RADIUS }),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "ttl", y: "value", title: (point) => ttlTipText(point, names, yLabel, logY) })),
    ],
  });
  body.replaceChildren(chart);
}

/** One point per policy and TTL with a value, `{ series, ttl, value }`, the series its policy, in TTL order. */
function policyPoints(rows, column) {
  const points = [];
  for (const policy of Object.keys(POLICY_NAMES)) {
    for (const ttl of TTLS) {
      const row = rows.find((candidate) => candidate.policy === policy && candidate.ttl === ttl);
      if (row !== undefined && row[column] !== null) {
        points.push({ series: policy, ttl, value: row[column] });
      }
    }
  }
  return points;
}

/**
 * One point per retained series not in `hidden` and TTL with a value, `{ series, ttl, value }`, the series `reusable`
 * or `dead`, each series' points in TTL order.
 */
export function retainedPoints(rows, hidden) {
  const points = [];
  for (const [series, column] of Object.entries(RETAINED_COLUMNS)) {
    if (hidden.has(series)) {
      continue;
    }
    for (const ttl of TTLS) {
      const row = rows.find((candidate) => candidate.ttl === ttl);
      if (row !== undefined && row[column] !== null) {
        points.push({ series, ttl, value: row[column] });
      }
    }
  }
  return points;
}

function providerLabel(provider) {
  return `Provider ${provider}`;
}

function idleGapTickLabel(seconds) {
  return IDLE_GAP_TICKS[seconds];
}

/** The TTL axis's labels: every TTL where the chart is wide enough, else every other one, or fewer. */
function ttlTickFormat(body) {
  const frame = chartFrame(body);
  const plotWidth = frame.width - frame.marginLeft - frame.marginRight;
  return sparseTickFormat(TTLS, ttlLabel, Math.floor(plotWidth / TTL_LABEL_SPACING));
}

function ttlLabel(ttl) {
  return ttl === "none" ? NO_TTL_LABEL : ttl;
}

function ttlTipText(point, names, yLabel, logY) {
  const value = logY ? point.value.toPrecision(3) : formatShare(point.value);
  return `${names[point.series]}\nTTL ${ttlLabel(point.ttl)}\n${yLabel}: ${value}`;
}

function idleGapTipText(point) {
  const bin = point.row.idle_gap_bin;
  const from = bin === 0 ? "up" : formatSeconds(idleGapEdgeSeconds(bin));
  const gap = `${from} to ${formatSeconds(idleGapEdgeSeconds(bin + 1))} idle`;
  return `${providerLabel(point.provider)}\n${gap}\nmedian hit ratio ${formatShare(point.hitRatio)}\n${formatCount(point.row.rows)} requests`;
}
