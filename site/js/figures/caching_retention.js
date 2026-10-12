/**
 * The Prefix-caching section's figures of the cache simulation: what each TTL of the TTL-only policy prefills against
 * what it keeps, for the paper's harnesses and for the benchmark replay. The simulation names these two populations
 * `Agentic` and `SWE-Bench`, its scopes; each was replayed on its own, and a figure draws them whatever harnesses are
 * selected.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines; `caching.js` lists them with the section's other
 * figures. `caption` is the one short line a card shows; `definition` states the figure in full.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import { SCOPE_COLOURS } from "../theme/colours.js";
import { formatTokens } from "../shared/format.js";
import { seriesLegend } from "./figure_rows.js";

// The simulation's scopes, as the pipeline's `population` names them, with the name each is drawn under, as the paper
// names them. tests/test_pipeline_mirrors_caching.py checks these, the TTL names and the labelled TTLs below against
// the pipeline.
const SCOPE_NAMES = Object.freeze({ Agentic: "Human-driven", "SWE-Bench": "Benchmark" });

const NO_TTL = "none"; // the TTL of a cache that keeps every block for the week
const NO_TTL_LABEL = "∞"; // how a figure writes the TTL `none`, as the paper does

// The TTLs whose points carry their name, per scope, as the paper labels them when it draws both curves, each with
// where its name sits: above and to the right of the point, or to its left, clear of the curve. Every point names its
// TTL in its tooltip.
const LABELLED_TTLS = Object.freeze({
  Agentic: Object.freeze({
    "1s": "right", "10s": "right", "1m": "right", "15m": "right", "1d": "right", [NO_TTL]: "right",
  }),
  "SWE-Bench": Object.freeze({ "1s": "right", "10s": "left", "1m": "left", "5m": "right" }),
});
// How a TTL's name is set beside its point, by where it sits: pixels across and up from the point, and the end of the
// name that is nearest it.
const LABEL_PLACEMENTS = Object.freeze({
  right: Object.freeze({ textAnchor: "start", dx: 6, dy: -9 }),
  left: Object.freeze({ textAnchor: "end", dx: -6, dy: 0 }),
});

// The prefill axis runs from just under the no-TTL floor to above the shortest TTL's prefill, as the paper's does, and
// marks these multiples of the floor.
const PREFILL_DOMAIN = Object.freeze([0.9, 60]);
const PREFILL_TICKS = Object.freeze([1, 2, 5, 10, 20, 50]);
// The retained-tokens axis runs from half the fewest retained tokens to three times the most, as the paper's does.
const RETAINED_LOW_DIVISOR = 2;
const RETAINED_HIGH_FACTOR = 3;

const MARKER_RADIUS = 3; // pixels; the small marker of each TTL's point

/** The figure of prefill against storage: one curve per scope, one labelled point per TTL. */
export const PREFILL_AGAINST_STORAGE = Object.freeze({
  name: "prefill_against_storage",
  title: "Prefill against storage",
  definition: "In the prefix-cache simulation of the TTL-only policy, the normalised prefill (missed tokens over those missed with no TTL) against the mean retained tokens (reusable and dead token-seconds over the span from the week's first request to its last), one point per TTL from 1 s to a day and ∞ (no TTL), some named as in the paper, for the paper's harnesses (human-driven) and for the benchmark replay, each simulated on its own and drawn whatever harnesses are selected, both axes logarithmic.",
  caption: "What each cache TTL prefills against the tokens it keeps, human-driven and benchmark.",
  query: "figures/prefill_against_storage",
  binColumn: "scope",
  seriesColumn: "scope",
  isSimulation: true,
  legend: scopeLegend,
  draw: drawPrefillAgainstStorage,
});

/** The legend of a figure of both scopes: human-driven, then benchmark, each in its scope colour. */
export function scopeLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, new Map(Object.entries(SCOPE_COLOURS)), SCOPE_NAMES);
}

/** The name a figure writes for a TTL: its own, or "∞" for no TTL. */
export function ttlLabel(ttl) {
  return ttl === NO_TTL ? NO_TTL_LABEL : ttl;
}

/**
 * One point per row of the prefill query, in its order: `{ scope, ttl, label, retained, prefill, placement }`, the
 * TTL's name written as `ttlLabel` writes it, and `placement` where that name is drawn beside the point, `right` or
 * `left`, or null for a TTL whose name is not drawn.
 */
export function prefillPoints(rows) {
  const points = [];
  for (const row of rows) {
    points.push({
      scope: row.scope,
      ttl: row.ttl,
      label: ttlLabel(row.ttl),
      retained: row.mean_retained_tokens,
      prefill: row.normalised_prefill,
      placement: LABELLED_TTLS[row.scope][row.ttl] ?? null,
    });
  }
  return points;
}

/** The retained-tokens axis's `[low, high]` for `points`: half their fewest retained tokens to three times the most. */
export function retainedDomain(points) {
  const retained = points.map((point) => point.retained);
  return [Math.min(...retained) / RETAINED_LOW_DIVISOR, Math.max(...retained) * RETAINED_HIGH_FACTOR];
}

/** The powers of ten from `low` to `high`, both included where they are powers of ten: a log axis's ticks. */
export function decadeTicks([low, high]) {
  const ticks = [];
  for (let exponent = Math.ceil(Math.log10(low)); 10 ** exponent <= high; exponent += 1) {
    ticks.push(10 ** exponent);
  }
  return ticks;
}

/** A multiple as an axis writes it: 2 → "2×". */
export function multipleText(multiple) {
  return `${multiple}×`;
}

/** Draw one line per scope through its TTLs' points, normalised prefill against mean retained tokens, on log axes. */
async function drawPrefillAgainstStorage(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const points = prefillPoints(rows);
  const present = new Set(points.map((point) => point.scope));
  const scopes = [...colours.series.keys()].filter((scope) => present.has(scope));
  const domain = retainedDomain(points);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain },
    y: { type: "log", domain: PREFILL_DOMAIN },
    color: colourScale(colours.series, scopes),
    marks: [
      Plot.gridX(decadeTicks(domain), GRID_STYLE),
      Plot.gridY(PREFILL_TICKS, GRID_STYLE),
      // The tick labels are given as text: a log axis's own tick format would leave out those it thinks crowded.
      Plot.axisX(decadeTicks(domain), {
        ...AXIS_STYLE, label: "Mean retained tokens", labelArrow: "none", text: formatTokens,
      }),
      Plot.axisY(PREFILL_TICKS, { ...AXIS_STYLE, label: "Normalised prefill", labelArrow: "none", text: multipleText }),
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
    const ink = { fill: "var(--chart-label)" };
    marks.push(Plot.text(placed, { x: "retained", y: "prefill", text: "label", ...ink, ...options }));
  }
  return marks;
}

function prefillTipText(point) {
  const prefill = `prefill ${point.prefill.toFixed(2)}× the no-TTL floor`;
  return `${SCOPE_NAMES[point.scope]}\nTTL ${point.label}\n${prefill}\n${formatTokens(point.retained)} tokens retained`;
}
