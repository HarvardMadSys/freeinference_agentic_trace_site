/**
 * The Prefix-caching section's figures of what the cache simulation's TTL-only policy costs at each TTL, for the
 * paper's harnesses: an API customer at the pipeline's prices, and an inference provider recomputing against storing,
 * each stacked by part as a multiple of a one-minute TTL, with the knee or the lowest total called out, drawn by the
 * knee-lines kind (`charts/knee_lines.js`).
 *
 * Their figure entries, whose fields CONTRIBUTING.md defines, are listed in `figures/caching.js` with the others.
 */

import { TOKEN_PART_COLOURS, VIOLET_SLOT } from "../theme/colours.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";
import { drawKneeLines, kneeLinesLegend } from "../charts/knee_lines.js";

// The parts of what an API customer pays, bottom up in the stack as the paper stacks them, each with its name, and of
// what an inference provider pays.
const API_PARTS = Object.freeze({
  output: TOKEN_PART_NAMES.output, cache_read: TOKEN_PART_NAMES.cached, input: TOKEN_PART_NAMES.uncached,
});
// The API legend lists the token parts as every legend of tokens does, output last: every part the stack draws, output
// too, though its stack is thin.
const API_LEGEND_ORDER = Object.freeze(["cache_read", "input", "output"]);
const INFRASTRUCTURE_PARTS = Object.freeze({ recompute: "Recompute", storage: "Storage" });
const INFRASTRUCTURE_LEGEND_ORDER = Object.freeze(Object.keys(INFRASTRUCTURE_PARTS)); // the stack's order, bottom up
// Each cost part's colour: the API's parts in the colours of the tokens they price, recomputing in the uncached
// input's, as it prefills the missed tokens again, and storage, which is neither a token part nor a part of a session's
// time, in violet.
const COST_PART_COLOURS = Object.freeze({
  output: TOKEN_PART_COLOURS.output, cache_read: TOKEN_PART_COLOURS.cached, input: TOKEN_PART_COLOURS.uncached,
  recompute: TOKEN_PART_COLOURS.uncached, storage: VIOLET_SLOT,
});

/** The figure of what an API customer pays per TTL, stacked by part, the knee called out. */
export const API_COST_BY_TTL = Object.freeze({
  name: "api_cost_by_ttl",
  title: "API cost by cache retention time",
  insight: "Most API savings come from relatively short cache retention.",
  definition: "Simulated API cost for different cache retention times, compared with a one-minute cache. Prices per 1 million tokens are $1 for cached input, $10 for uncached input, and $50 for output. The marker shows the shortest retention time with a cost within 5% of the lowest cost.",
  caption: "Extending retention from one to 30 minutes reduces modeled API cost by 35%. Longer retention continues reducing recomputation, but provides diminishing additional savings.",
  query: "figures/api_cost_by_ttl",
  binColumn: "part",
  seriesColumn: "part",
  seriesOverSameRows: true,
  readsSimulation: true,
  legend: (rows) => kneeLinesLegend(rows, costColours(API_LEGEND_ORDER), { parts: API_PARTS }),
  draw: (rows, body, colours, hidden) => drawKneeLines(rows, body, colours, {
    parts: API_PARTS,
    calloutColumn: "is_knee",
    calloutText: kneeText,
  }, hidden),
});

/** The figure of what an inference provider pays per TTL, recomputing against storing, the cheapest TTL called out. */
export const INFRASTRUCTURE_COST_BY_TTL = Object.freeze({
  name: "infrastructure_cost_by_ttl",
  title: "Serving cost by cache retention time",
  insight: "The cache that saves the most computation isn't the cheapest to run.",
  definition: "Simulated serving cost for different cache retention times, compared with a one-minute cache. Processing uncached input costs $1 per 1 million tokens. Storage costs $30 per 1 million tokens per day, including tokens that will not be used again.",
  caption: "Simulated infrastructure cost reaches its minimum at 15 minutes, falling to 42% of the one-minute baseline. Longer retention increases storage cost faster than it reduces recomputation.",
  query: "figures/infrastructure_cost_by_ttl",
  binColumn: "part",
  seriesColumn: "part",
  seriesOverSameRows: true,
  readsSimulation: true,
  legend: (rows) => kneeLinesLegend(rows, costColours(INFRASTRUCTURE_LEGEND_ORDER), { parts: INFRASTRUCTURE_PARTS }),
  draw: (rows, body, colours, hidden) => drawKneeLines(rows, body, colours, {
    parts: INFRASTRUCTURE_PARTS,
    calloutColumn: "is_lowest",
    calloutText: lowestText,
  }, hidden),
});

/** The cost parts of `order` with their colours, in that order, as a cost figure's legend lists them. */
export function costColours(order) {
  const colours = new Map();
  for (const part of order) {
    colours.set(part, COST_PART_COLOURS[part]);
  }
  return colours;
}

/**
 * The API cost's callout, on two lines so that it fits a phone's chart: the knee's total and TTL, and that it is near
 * the lowest, "0.65× at 30 min,\nnear the lowest".
 */
export function kneeText(total, ttl) {
  return `${total} at ${ttl},\nnear the lowest`;
}

/** The infrastructure cost's callout, on two lines: the lowest total and its TTL, "Lowest 0.42×\nat 15 min". */
export function lowestText(total, ttl) {
  return `Lowest ${total}\nat ${ttl}`;
}
