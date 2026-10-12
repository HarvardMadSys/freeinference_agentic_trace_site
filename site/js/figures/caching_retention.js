/**
 * The Prefix-caching section's figures of the cache simulation: what each TTL of the TTL-only policy prefills against
 * what it keeps, for the paper's harnesses and for the benchmark replay, and what it costs an API customer and an
 * inference provider, for the paper's harnesses. The simulation names these two populations `Agentic` and
 * `SWE-Bench`, its scopes; each was replayed on its own, and a figure draws them whatever harnesses are selected.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines; `caching.js` lists them with the section's other
 * figures. `caption` is the one short line a card shows; `definition` states the figure in full.
 */

import { AXIS_STYLE, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, TIP_STYLE } from "../shared/charts.js";
import { SCOPE_COLOURS, SERIES_SLOTS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { formatTokens } from "../shared/format.js";
import { decadeTicks, multipleText, seriesLegend } from "./figure_rows.js";

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

// The parts of what an API customer pays, bottom up in the stack as the paper stacks them, each with its name, and of
// what an inference provider pays.
const API_PARTS = Object.freeze({ output: "Output", cache_read: "Cached input", input: "Uncached input" });
const INFRASTRUCTURE_PARTS = Object.freeze({ recompute: "Recompute", storage: "Storage" });
// Each cost part's colour: the API's parts in the colours of the tokens they price, recomputing in the uncached
// input's, as it prefills the missed tokens again, and storage in the yellow the paper gives it.
const COST_PART_COLOURS = Object.freeze({
  output: TOKEN_PART_COLOURS.output, cache_read: TOKEN_PART_COLOURS.cached, input: TOKEN_PART_COLOURS.uncached,
  recompute: TOKEN_PART_COLOURS.uncached, storage: SERIES_SLOTS[3],
});
const COST_AXIS_TTLS = Object.freeze(["1s", "10s", "1m", "10m", "1h", "1d"]); // the TTLs a cost figure's axis names
const COST_AXIS_HEADROOM = 1.1; // a cost axis ends a tenth above the highest stack, as the paper's does
const COST_AXIS_TICKS = 5; // about this many ticks on a cost axis

const MARKER_RADIUS = 3; // pixels; the small marker of each TTL's point
const CALLOUT_RADIUS = 5; // pixels; the hollow marker on the TTL a cost figure calls out
const CALLOUT_RISE_SHARE = 0.45; // its text sits this share of the cost axis above it, as the paper's does
const CALLOUT_HALO = 3; // pixels of the card's colour around the callout's text

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

/** The figure of what an API customer pays per TTL, stacked by part, the knee called out. */
export const API_COST_BY_TTL = Object.freeze({
  name: "api_cost_by_ttl",
  title: "API cost by TTL",
  definition: "In the prefix-cache simulation of the paper's harnesses under the TTL-only policy, drawn whatever harnesses are selected, what each TTL from 1 s to a day costs an API customer at the pipeline's prices (cached 1, uncached 10, output 50 per token): the missed input at the uncached price, the cache reads at the cached price and the output, stacked, each as a multiple of the total at a one-minute TTL (dashed at 1×), the knee called out, the shortest TTL whose total is within 5% of the lowest, ∞ (no TTL) included.",
  caption: "What an API customer pays at each cache TTL, as a multiple of a one-minute TTL.",
  query: "figures/api_cost_by_ttl",
  binColumn: "part",
  seriesColumn: "part",
  seriesOverSameRows: true,
  isSimulation: true,
  legend: (rows, colours, seriesColumn) => costLegend(rows, seriesColumn, API_PARTS),
  draw: (rows, body, colours) => drawCostByTtl(rows, body, colours, {
    labels: API_PARTS, flag: "is_knee", word: "Knee",
  }),
});

/** The figure of what an inference provider pays per TTL, recomputing against storing, the cheapest TTL called out. */
export const INFRASTRUCTURE_COST_BY_TTL = Object.freeze({
  name: "infrastructure_cost_by_ttl",
  title: "Infrastructure cost by TTL",
  definition: "In the prefix-cache simulation of the paper's harnesses under the TTL-only policy, drawn whatever harnesses are selected, what each TTL from 1 s to a day costs an inference provider at the pipeline's prices: prefilling the missed tokens again at $1 per million and keeping the reusable and dead tokens in memory at $30 per million a day, stacked, each as a multiple of the total at a one-minute TTL (dashed at 1×), the TTL of the lowest total called out, ∞ (no TTL) included.",
  caption: "What serving costs at each cache TTL, recomputing misses against storing tokens.",
  query: "figures/infrastructure_cost_by_ttl",
  binColumn: "part",
  seriesColumn: "part",
  seriesOverSameRows: true,
  isSimulation: true,
  legend: (rows, colours, seriesColumn) => costLegend(rows, seriesColumn, INFRASTRUCTURE_PARTS),
  draw: (rows, body, colours) => drawCostByTtl(rows, body, colours, {
    labels: INFRASTRUCTURE_PARTS, flag: "is_lowest", word: "Lowest",
  }),
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

/**
 * The legend of a cost figure: the parts of `labels` (part to name) the rows hold, bottom up in the stack, each in its
 * cost part colour.
 */
export function costLegend(rows, seriesColumn, labels) {
  const colours = new Map();
  for (const part of Object.keys(labels)) {
    colours.set(part, COST_PART_COLOURS[part]);
  }
  return seriesLegend(rows, seriesColumn, colours, labels);
}

/**
 * Per TTL of a cost query's rows, in their order: `{ seconds, ttl, top, text }`, `top` the sum of its parts' multiples
 * (the top of the stack) and `text` its tooltip, naming its multiple of each part of `labels` (part to name) the rows
 * hold, top of the stack first, and the TTL's total of every part.
 */
export function costStacks(rows, labels) {
  const rowsByTtl = new Map();
  for (const row of rows) {
    rowsByTtl.set(row.ttl, [...(rowsByTtl.get(row.ttl) ?? []), row]);
  }
  const stacks = [];
  for (const [ttl, ttlRows] of rowsByTtl) {
    const lines = [`TTL ${ttl}`];
    let top = 0;
    for (const part of Object.keys(labels).reverse()) {
      const row = ttlRows.find((one) => one.part === part);
      if (row !== undefined) {
        lines.push(`${labels[part]} ${row.cost_multiple.toFixed(2)}×`);
        top += row.cost_multiple;
      }
    }
    lines.push(`Total ${ttlRows[0].total_multiple.toFixed(2)}×`);
    stacks.push({ seconds: ttlRows[0].ttl_seconds, ttl, top, text: lines.join("\n") });
  }
  return stacks;
}

/**
 * The TTL a cost figure calls out, the one whose rows are marked in the column `flag`: `{ seconds, top, text }`, at
 * the top of its stack, its text `word`, its total and its TTL ("Knee 0.65× at 30m"); null when no drawn TTL is marked.
 */
export function calloutPoint(rows, stacks, flag, word) {
  const marked = rows.find((row) => row[flag]);
  if (marked === undefined) {
    return null;
  }
  const stack = stacks.find((one) => one.ttl === marked.ttl);
  const text = `${word} ${marked.total_multiple.toFixed(2)}× at ${marked.ttl}`;
  return { seconds: stack.seconds, top: stack.top, text };
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

/**
 * Draw a cost query's rows into `body` as an area per part of `labels` (part to name) the rows hold, stacked bottom up
 * in that order over the TTLs on a log axis, a dashed line at the one-minute total, and the TTL marked in the column
 * `flag` called out with `word`.
 */
async function drawCostByTtl(rows, body, colours, { labels, flag, word }) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const present = new Set(rows.map((row) => row.part));
  const parts = Object.keys(labels).filter((part) => present.has(part));
  const stacks = costStacks(rows, labels);
  const callout = calloutPoint(rows, stacks, flag, word);
  const highestCost = Math.max(...stacks.map((stack) => stack.top)) * COST_AXIS_HEADROOM;
  const ticks = stacks.filter((stack) => COST_AXIS_TTLS.includes(stack.ttl));
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [stacks[0].seconds, stacks[stacks.length - 1].seconds] },
    y: { domain: [0, highestCost] },
    color: colourScale(colours.series, parts),
    marks: [
      Plot.gridX(ticks, { ...GRID_STYLE, x: "seconds" }),
      Plot.gridY({ ...GRID_STYLE, ticks: COST_AXIS_TICKS }),
      Plot.axisX(ticks, { ...AXIS_STYLE, x: "seconds", label: null, text: "ttl" }),
      Plot.axisY({ ...AXIS_STYLE, label: null, ticks: COST_AXIS_TICKS, tickFormat: multipleText }),
      Plot.areaY(rows, { x: "ttl_seconds", y: "cost_multiple", fill: "part", order: parts }),
      Plot.ruleY([1], { ...AXIS_STYLE, strokeDasharray: DASH }),
      ...calloutMarks(Plot, callout, highestCost),
      Plot.tip(stacks, Plot.pointerX({ ...TIP_STYLE, x: "seconds", y: "top", title: "text" })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * A cost figure's callout marks, none without one: a hollow marker on the top of its stack, and a straight leader up
 * from it to its text, a share of the axis's `highestCost` higher.
 */
function calloutMarks(Plot, callout, highestCost) {
  if (callout === null) {
    return [];
  }
  const placed = [{ ...callout, textAt: callout.top + CALLOUT_RISE_SHARE * highestCost }];
  const ink = { stroke: "var(--chart-label)", fill: "var(--color-surface)" };
  const halo = { fill: "var(--chart-label)", stroke: "var(--color-surface)", strokeWidth: CALLOUT_HALO };
  return [
    Plot.ruleX(placed, { x: "seconds", y1: "top", y2: "textAt", stroke: "var(--chart-label)" }),
    Plot.dot(placed, { x: "seconds", y: "top", r: CALLOUT_RADIUS, strokeWidth: LINE_WIDTH, ...ink }),
    Plot.text(placed, { x: "seconds", y: "textAt", text: "text", lineAnchor: "bottom", ...halo }),
  ];
}
