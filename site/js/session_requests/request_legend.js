/** The legend of the Requests view: the colours of a bar's parts, and of the tool categories of the chips. */

import { categoryEntries, legendLine } from "../session/legend.js";
import { OTHER_SERIES, TOKEN_PART_COLOURS } from "../theme/colours.js";

/**
 * The legend's two lines, `{ tokens, categories }`, each `[{ name, colour }]`: the bar parts (with "no cache
 * report" only when a request has no cache reads), then the categories of `toolCalls` in the site-wide order of
 * `categoryColours`, the ones folded into the Other colour as one entry.
 */
export function legendEntries(requests, toolCalls, categoryColours) {
  const tokens = [
    { name: "cached input", colour: TOKEN_PART_COLOURS.cached },
    { name: "uncached input", colour: TOKEN_PART_COLOURS.uncached },
    { name: "output", colour: TOKEN_PART_COLOURS.output },
  ];
  if (requests.some((request) => request.cache_read_tokens === null)) {
    tokens.push({ name: "input, no cache report", colour: OTHER_SERIES });
  }
  return { tokens, categories: categoryEntries(toolCalls, categoryColours) };
}

/** The legend for `requests`, their `toolCalls` and the chip colours `categoryColours`, as one element. */
export function requestLegend(requests, toolCalls, categoryColours) {
  const { tokens, categories } = legendEntries(requests, toolCalls, categoryColours);
  const legend = document.createElement("div");
  legend.append(legendLine("Tokens", tokens));
  if (categories.length > 0) {
    legend.append(legendLine("Tool calls", categories));
  }
  return legend;
}
