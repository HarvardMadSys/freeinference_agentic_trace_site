/**
 * The Prefix-caching section's figures of what the cache simulation's TTL-only policy costs at each TTL, for the
 * paper's harnesses: an API customer at the pipeline's prices, and an inference provider recomputing against storing,
 * each stacked by part as a multiple of a one-minute TTL, with the knee or the lowest total called out.
 *
 * Their figure entries, whose fields CONTRIBUTING.md defines, are listed in `figures/caching.js` with the others.
 */

import { AXIS_STYLE, chartFrame, colourScale, DASH, GRID_STYLE, LINE_WIDTH, TIP_STYLE, X_INSET } from "../shared/charts.js";
import { axisWithTicks, TICK_COUNT } from "../axes/ticks.js";
import { SERIES_SLOTS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { formatMultiple } from "../shared/format.js";
import { seriesLegend } from "../figures/figure_rows.js";
import { MULTIPLE_DECIMALS, multipleTick, ttlLabel } from "./prefill.js";

// The parts of what an API customer pays, bottom up in the stack as the paper stacks them, each with its name, and of
// what an inference provider pays.
const API_PARTS = Object.freeze({ output: "Output", cache_read: "Cached input", input: "Uncached input" });
const API_LEGEND_ORDER = Object.freeze(["cache_read", "input", "output"]); // as every legend lists the token parts
const INFRASTRUCTURE_PARTS = Object.freeze({ recompute: "Recompute", storage: "Storage" });
// Each cost part's colour: the API's parts in the colours of the tokens they price, recomputing in the uncached
// input's, as it prefills the missed tokens again, and storage in the yellow the paper gives it.
const COST_PART_COLOURS = Object.freeze({
  output: TOKEN_PART_COLOURS.output, cache_read: TOKEN_PART_COLOURS.cached, input: TOKEN_PART_COLOURS.uncached,
  recompute: TOKEN_PART_COLOURS.uncached, storage: SERIES_SLOTS[3],
});
const COST_AXIS_TTLS = Object.freeze(["1s", "1m", "1h", "1d"]); // the TTLs a cost figure's axis names, room between
const COST_AXIS_HEADROOM = 1.1; // a cost axis ends a tenth above the highest stack, as the paper's does
const CALLOUT_RADIUS = 5; // pixels; the hollow marker on the TTL a cost figure calls out
const CALLOUT_RISE_SHARE = 0.45; // its text sits this share of the cost axis above it, as the paper's does
const CALLOUT_HALO = 3; // pixels of the card's colour around the callout's text

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
  legend: (rows, colours, seriesColumn) => costLegend(rows, seriesColumn, API_PARTS, API_LEGEND_ORDER),
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

/**
 * The legend of a cost figure: the parts of `labels` (part to name) the rows hold, in the order of `order` (the stack's,
 * bottom up, unless given), each in its cost part colour.
 */
export function costLegend(rows, seriesColumn, labels, order = Object.keys(labels)) {
  const colours = new Map();
  for (const part of order) {
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
    if (!rowsByTtl.has(row.ttl)) {
      rowsByTtl.set(row.ttl, []);
    }
    rowsByTtl.get(row.ttl).push(row);
  }
  const stacks = [];
  for (const [ttl, ttlRows] of rowsByTtl) {
    const lines = [`TTL ${ttlLabel(ttl)}`];
    let top = 0;
    for (const part of Object.keys(labels).reverse()) {
      const row = ttlRows.find((one) => one.part === part);
      if (row !== undefined) {
        lines.push(`${labels[part]} ${formatMultiple(row.cost_multiple, MULTIPLE_DECIMALS)}`);
        top += row.cost_multiple;
      }
    }
    lines.push(`Total ${formatMultiple(ttlRows[0].total_multiple, MULTIPLE_DECIMALS)}`);
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
  const text = `${word} ${formatMultiple(marked.total_multiple, MULTIPLE_DECIMALS)} at ${ttlLabel(marked.ttl)}`;
  return { seconds: stack.seconds, top: stack.top, text };
}

/**
 * Draw a cost query's rows into `body` as an area per part of `labels` (part to name) the rows hold, stacked bottom up
 * in that order over the TTLs on a log axis, a dashed line at the one-minute total, and the TTL marked in the column
 * `flag` called out with `word`.
 */
async function drawCostByTtl(rows, body, colours, { labels, flag, word }) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const parts = Object.keys(labels).filter((part) => rows.some((row) => row.part === part));
  const stacks = costStacks(rows, labels);
  const callout = calloutPoint(rows, stacks, flag, word);
  const highestCost = Math.max(...stacks.map((stack) => stack.top)) * COST_AXIS_HEADROOM;
  const ttlLabels = new Map();
  for (const stack of stacks.filter((one) => COST_AXIS_TTLS.includes(one.ttl))) {
    ttlLabels.set(stack.seconds, ttlLabel(stack.ttl));
  }
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [stacks[0].seconds, stacks[stacks.length - 1].seconds], inset: X_INSET },
    y: { domain: [0, highestCost] },
    color: colourScale(colours.series, parts),
    marks: [
      Plot.gridX([...ttlLabels.keys()], GRID_STYLE),
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      axisWithTicks(Plot.axisX, [...ttlLabels.keys()], {
        ...AXIS_STYLE, label: null, tickFormat: (seconds) => ttlLabels.get(seconds),
      }),
      Plot.axisY({ ...AXIS_STYLE, label: null, ticks: TICK_COUNT, tickFormat: multipleTick }),
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
