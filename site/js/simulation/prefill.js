/**
 * The Prefix-caching section's figure of what each TTL of the cache simulation's TTL-only policy prefills against what
 * it keeps, for the paper's harnesses and for the benchmark replay, and how a figure of the simulation writes a TTL and
 * a multiple. The simulation names these two populations `Agentic` and `SWE-Bench`, its scopes; each was replayed on
 * its own, and the figure draws them whatever harnesses are selected.
 *
 * Its figure entry, whose fields CONTRIBUTING.md defines, is listed in `figures/caching.js` with the section's others.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import { axisWithTicks, isNarrowChart, logAxisTicks, maxTicksFor } from "../axes/ticks.js";
import { formatCountTick, formatMultiple, formatTokens, formatTtlName } from "../shared/format.js";
import { SCOPE_LABELS, scopeLegend } from "../comparison/scopes.js";

// tests/test_pipeline_mirrors_caching.py checks the TTL names and the labelled TTLs below against the pipeline.
const NO_TTL = "none"; // the TTL of a cache that keeps every block for the week
const NO_TTL_LABEL = "∞"; // how a figure writes the TTL `none`, as the paper does

// The TTLs whose points carry their name, per scope, as the paper labels them when it draws both curves, each with
// where its name sits: above and to the right of the point for the human-driven curve; for the benchmark's, below and
// to the left under its falling curve, then level and to the left, then above and to the right where it is flat, so
// no name sits on the other curve. Every point names its TTL in its tooltip.
const LABELLED_TTLS = Object.freeze({
  Agentic: Object.freeze({
    "1s": "right", "10s": "right", "1m": "right", "15m": "right", "1d": "right", [NO_TTL]: "right",
  }),
  "SWE-Bench": Object.freeze({ "1s": "below", "10s": "below", "1m": "left", "5m": "right" }),
});
// The fewer TTLs named on a narrow chart, each to the right of its point, clear of the prefill axis's labels on the
// left; the tooltip still names every point.
const NARROW_LABELLED_TTLS = Object.freeze({
  Agentic: Object.freeze({ "1s": "right", "1m": "right", "15m": "right", [NO_TTL]: "right" }),
  "SWE-Bench": Object.freeze({ "1s": "right", "1m": "right" }),
});
// How a TTL's name is set beside its point, by where it sits: pixels across and up from the point, and the end of the
// name that is nearest it.
const LABEL_PLACEMENTS = Object.freeze({
  right: Object.freeze({ textAnchor: "start", dx: 6, dy: -9 }),
  below: Object.freeze({ textAnchor: "end", dx: -6, dy: 12 }),
  left: Object.freeze({ textAnchor: "end", dx: -6, dy: 0 }),
});
const LABEL_HALO = 4; // pixels of the card's colour around a TTL's name, so no curve crosses it

// The prefill axis runs from just under the no-TTL floor to above the shortest TTL's prefill, as the paper's does, and
// marks these multiples of the floor.
const PREFILL_DOMAIN = Object.freeze([0.9, 60]);
const PREFILL_TICKS = Object.freeze([1, 2, 5, 10, 20, 50]);
// The retained-tokens axis runs from half the fewest retained tokens to three times the most, as the paper's does.
const RETAINED_LOW_DIVISOR = 2;
const RETAINED_HIGH_FACTOR = 3;
/** A multiple in a tooltip or a callout, with two decimals: 0.65×. */
export const MULTIPLE_DECIMALS = 2;
const MARKER_RADIUS = 3; // pixels; the small marker of each TTL's point

/** The figure of prefill against storage: one curve per scope, one labelled point per TTL. */
export const PREFILL_AGAINST_STORAGE = Object.freeze({
  name: "prefill_against_storage",
  title: "Prefill against storage",
  definition: "In the prefix-cache simulation of every week it covers, normalised prefill (tokens missed over those missed with no TTL) against mean retained tokens (token-seconds kept over the week's span), one point per TTL, human-driven and benchmark simulated apart.",
  caption: "Missed tokens against tokens kept, per cache TTL, human-driven and benchmark.",
  isWide: true,
  drawsLines: true,
  query: "figures/prefill_against_storage",
  binColumn: "scope",
  seriesColumn: "scope",
  isSimulation: true,
  legend: scopeLegend,
  draw: drawPrefillAgainstStorage,
});

/** How a figure writes a TTL's name, as every duration is written: "1m" → "1 min"; "∞" for no TTL. */
export function ttlLabel(ttl) {
  return ttl === NO_TTL ? NO_TTL_LABEL : formatTtlName(ttl);
}

/**
 * One point per row of the prefill query, in its order: `{ scope, ttl, label, retained, prefill, placement }`, the
 * TTL's name written as `ttlLabel` writes it, and `placement` where `labelled` (by scope, each named TTL's place; the
 * paper's unless given) draws that name beside the point, `right`, `below` or `left`, or null for a TTL whose name is not
 * drawn.
 */
export function prefillPoints(rows, labelled = LABELLED_TTLS) {
  const points = [];
  for (const row of rows) {
    points.push({
      scope: row.scope,
      ttl: row.ttl,
      label: ttlLabel(row.ttl),
      retained: row.mean_retained_tokens,
      prefill: row.normalised_prefill,
      placement: labelled[row.scope][row.ttl] ?? null,
    });
  }
  return points;
}

/** The retained-tokens axis's `[low, high]` for `points`: half their fewest retained tokens to three times the most. */
export function retainedDomain(points) {
  const retained = points.map((point) => point.retained);
  return [Math.min(...retained) / RETAINED_LOW_DIVISOR, Math.max(...retained) * RETAINED_HIGH_FACTOR];
}

/** Draw one line per scope through its TTLs' points, normalised prefill against mean retained tokens, on log axes. */
async function drawPrefillAgainstStorage(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const frame = chartFrame(body);
  const points = prefillPoints(rows, isNarrowChart(frame.width) ? NARROW_LABELLED_TTLS : LABELLED_TTLS);
  const scopes = [...colours.series.keys()].filter((scope) => points.some((point) => point.scope === scope));
  const domain = retainedDomain(points);
  const retainedTicks = logAxisTicks(domain, maxTicksFor(frame.width));
  const chart = Plot.plot({
    ...frame,
    x: { type: "log", domain },
    y: { type: "log", domain: PREFILL_DOMAIN },
    color: colourScale(colours.series, scopes),
    marks: [
      Plot.gridX(retainedTicks, GRID_STYLE),
      Plot.gridY(PREFILL_TICKS, GRID_STYLE),
      axisWithTicks(Plot.axisX, retainedTicks, {
        ...AXIS_STYLE, label: "Mean retained tokens", tickFormat: formatCountTick,
      }),
      axisWithTicks(Plot.axisY, PREFILL_TICKS, { ...AXIS_STYLE, label: "Normalised prefill", tickFormat: multipleTick }),
      Plot.line(points, { x: "retained", y: "prefill", stroke: "scope", strokeWidth: LINE_WIDTH }),
      Plot.dot(points, { x: "retained", y: "prefill", fill: "scope", r: MARKER_RADIUS }),
      ...ttlNameMarks(Plot, points),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "retained", y: "prefill", title: prefillTipText })),
    ],
  });
  body.replaceChildren(chart);
}

/** One text mark per placement, naming the TTL of each point placed there. */
function ttlNameMarks(Plot, points) {
  const marks = [];
  for (const [placement, options] of Object.entries(LABEL_PLACEMENTS)) {
    const placed = points.filter((point) => point.placement === placement);
    const ink = {
      fill: "var(--chart-label)", stroke: "var(--color-surface)", strokeWidth: LABEL_HALO, paintOrder: "stroke",
    };
    marks.push(Plot.text(placed, { x: "retained", y: "prefill", text: "label", ...ink, ...options }));
  }
  return marks;
}

function prefillTipText(point) {
  const prefill = `prefill ${formatMultiple(point.prefill, MULTIPLE_DECIMALS)} the no-TTL floor`;
  return `${SCOPE_LABELS[point.scope]}\nTTL ${point.label}\n${prefill}\n${formatTokens(point.retained)} tokens retained`;
}

/** A multiple as an axis writes it, as it is: "2×"; Plot also passes a tick's index, which is no number of decimals. */
export function multipleTick(multiple) {
  return formatMultiple(multiple);
}
