/**
 * The Prefix-caching section of the Paper figures page: how much of a request's input the provider served from
 * cache, after an idle gap and after each kind of context change, and what the cache simulation says each TTL and
 * eviction policy would keep.
 *
 * Each figure is `{ name, title, definition, query, binColumn, seriesOverSameRows, isSimulation, draw }`, as in the
 * Sessions section; `binColumn` is null when every row is a bin of its own, and a figure that `isSimulation` draws
 * the simulation's Agentic rows whatever scope is selected.
 */

import { AXIS_STYLE, assignColours, chartFrame, colourScale, drawBars, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import { formatCount, formatSeconds, formatShare } from "../shared/format.js";
import { sparseTickFormat } from "./figure_rows.js";

// The idle-gap bins mirror the pipeline's `gaps.IDLE_GAP_EDGES_S`: 26 bins between 27 geometric edges from 10 s to
// one hour, each 1.25 times as wide as the one before.
const FIRST_IDLE_GAP_EDGE_S = 10;
const LAST_IDLE_GAP_EDGE_S = 3600;
const IDLE_GAP_BINS = 26;
// The idle gaps the axis marks, in seconds, each with its label.
const IDLE_GAP_TICKS = Object.freeze({ 10: "10s", 60: "1m", 300: "5m", 900: "15m", 3600: "1h" });
const IDLE_GAP_TICK_SECONDS = Object.freeze(Object.keys(IDLE_GAP_TICKS).map(Number));

// A request's transition, how its context changed from the request before it, in the order the bars are drawn.
const TRANSITIONS = Object.freeze(["append", "mutation", "switch"]);

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

const MARKER_RADIUS = 3; // pixels; the small markers on every line of the section
const REFERENCE_DASH = "4 3"; // dash and gap lengths of the line where dead equals active token-seconds, in pixels
const PLAIN_NUMBER_FORMAT = "~g"; // a log axis writes 0.001 and 100, not Plot's SI "1m" and "100"

/** The figures of the Prefix-caching section, in the order the page shows them. */
export const FIGURES = Object.freeze([
  Object.freeze({
    name: "hit_ratio_by_idle_gap",
    title: "Hit ratio after an idle gap",
    definition: "Median hit ratio (cached over input tokens) of requests per bin of idle gap (the time since the same user's previous request at the provider finished; 26 geometric bins from 10 s to 1 h, each drawn at its middle), one line per provider, where the paper merges a bin of fewer than 20 requests into the next, draws it at its requests' median gap and shows the four providers with most idle gaps.",
    query: "figures/hit_ratio_by_idle_gap",
    binColumn: null,
    draw: drawIdleGapRetention,
  }),
  Object.freeze({
    name: "hit_ratio_by_transition",
    title: "Hit ratio after a context change",
    definition: "Mean hit ratio (cached over input tokens) of the requests that append to the context before them, mutate it, or switch model or provider, where the paper draws the CDFs of appends and mutations and leaves switches out.",
    query: "figures/hit_ratio_by_transition",
    binColumn: "transition",
    draw: drawTransitionHitRatios,
  }),
  Object.freeze({
    name: "simulated_hit_ratio_by_ttl",
    title: "Simulated hit ratio by TTL",
    definition: "Hit tokens over hit and missed tokens in the prefix-cache simulation of the Agentic scope, whatever scope is selected, per cache TTL and eviction policy, where the paper draws the TTL-only policy's misses as prefill against storage.",
    query: "figures/simulated_hit_ratio_by_ttl",
    binColumn: "policy",
    seriesOverSameRows: true,
    isSimulation: true,
    draw: drawSimulatedHitRatios,
  }),
  Object.freeze({
    name: "dead_over_active_by_policy",
    title: "Dead over active cache by policy",
    definition: "Token-seconds that cached blocks stay after their last read over those of the blocks requests in flight hold, in the prefix-cache simulation of the Agentic scope, whatever scope is selected, per cache TTL and eviction policy, where the paper draws the TTL-only and reclaim-mutate policies only up to a day.",
    query: "figures/dead_over_active_by_policy",
    binColumn: "policy",
    seriesOverSameRows: true,
    isSimulation: true,
    draw: drawDeadOverActive,
  }),
]);

/** An idle-gap edge in seconds: edge 0 is 10 s and edge 26 one hour; a fractional edge lies between, geometrically. */
export function idleGapEdgeSeconds(edge) {
  return FIRST_IDLE_GAP_EDGE_S * (LAST_IDLE_GAP_EDGE_S / FIRST_IDLE_GAP_EDGE_S) ** (edge / IDLE_GAP_BINS);
}

/** Draw one line per provider of its median hit ratio per idle-gap bin, on a log axis of seconds, with markers. */
async function drawIdleGapRetention(rows, body) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const points = rows.map((row) => ({
    provider: `Provider ${row.provider}`,
    seconds: idleGapEdgeSeconds(row.idle_gap_bin + 0.5), // the bin's geometric middle
    hitRatio: row.median_hit_ratio,
    row,
  }));
  const providers = [...new Set(points.map((point) => point.provider))];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [FIRST_IDLE_GAP_EDGE_S, LAST_IDLE_GAP_EDGE_S] },
    y: { domain: [0, 1] },
    color: colourScale(assignColours(providers), providers, true),
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

/** Draw one bar per transition of the mean hit ratio of the requests after it. */
async function drawTransitionHitRatios(rows, body) {
  const present = new Set(rows.map((row) => row.transition));
  await drawBars(body, rows, {
    x: "transition",
    y: "mean_hit_ratio",
    fill: "transition",
    order: TRANSITIONS,
    colours: assignColours(TRANSITIONS),
    xDomain: TRANSITIONS.filter((transition) => present.has(transition)),
    xLabel: "Transition",
    yLabel: "Mean hit ratio",
    format: formatShare,
  });
}

/** Draw one line per policy of its simulated hit ratio per TTL. */
async function drawSimulatedHitRatios(rows, body) {
  await drawPolicyLines(rows, body, { column: "hit_ratio", yLabel: "Simulated hit ratio", logY: false });
}

/** Draw one line per policy of its dead over active token-seconds per TTL, on a log axis, with a line at one. */
async function drawDeadOverActive(rows, body) {
  await drawPolicyLines(rows, body, { column: "dead_over_active", yLabel: "Dead / active", logY: true });
}

/**
 * Draw one line per eviction policy, in the fixed policy order and colours, of `row[column]` over the TTLs in their
 * fixed order, with markers. A share axis runs from 0 to 1; a log axis (`logY`) marks one with a dashed line.
 */
async function drawPolicyLines(rows, body, { column, yLabel, logY }) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const points = policyPoints(rows, column);
  const policyNames = Object.values(POLICY_NAMES);
  const shown = policyNames.filter((name) => points.some((point) => point.policy === name));
  const reference = logY ? [Plot.ruleY([1], { ...AXIS_STYLE, strokeDasharray: REFERENCE_DASH })] : [];
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "point", domain: TTLS },
    y: logY ? { type: "log" } : { domain: [0, 1] },
    color: colourScale(assignColours(policyNames), shown, true),
    marks: [
      Plot.gridY(GRID_STYLE),
      ...reference,
      Plot.axisX({ ...AXIS_STYLE, label: "Cache TTL", tickFormat: ttlTickFormat(body) }),
      Plot.axisY({ ...AXIS_STYLE, label: yLabel, tickFormat: logY ? PLAIN_NUMBER_FORMAT : "%" }),
      Plot.line(points, { x: "ttl", y: "value", stroke: "policy", strokeWidth: LINE_WIDTH }),
      Plot.dot(points, { x: "ttl", y: "value", fill: "policy", r: MARKER_RADIUS }),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "ttl", y: "value", title: (point) => policyTipText(point, yLabel, logY) })),
    ],
  });
  body.replaceChildren(chart);
}

/** One point per policy and TTL with a value, `{ policy, ttl, value }`, each policy's points in TTL order. */
function policyPoints(rows, column) {
  const points = [];
  for (const [policy, name] of Object.entries(POLICY_NAMES)) {
    for (const ttl of TTLS) {
      const row = rows.find((candidate) => candidate.policy === policy && candidate.ttl === ttl);
      if (row !== undefined && row[column] !== null) {
        points.push({ policy: name, ttl, value: row[column] });
      }
    }
  }
  return points;
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

function policyTipText(point, yLabel, logY) {
  const value = logY ? point.value.toPrecision(3) : formatShare(point.value);
  return `${point.policy}\nTTL ${ttlLabel(point.ttl)}\n${yLabel}: ${value}`;
}

function idleGapTipText(point) {
  const bin = point.row.idle_gap_bin;
  const from = bin === 0 ? "up" : formatSeconds(idleGapEdgeSeconds(bin));
  const gap = `${from} to ${formatSeconds(idleGapEdgeSeconds(bin + 1))} idle`;
  return `${point.provider}\n${gap}\nmedian hit ratio ${formatShare(point.hitRatio)}\n${formatCount(point.row.rows)} requests`;
}
