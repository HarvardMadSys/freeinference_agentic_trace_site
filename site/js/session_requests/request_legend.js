/** The legend of the Requests view: the colours of a bar's parts, and of the tool categories of the chips. */

import { categoryEntries, legendLine } from "../session/legend.js";
import { tokenPartEntries } from "../session/token_parts.js";

/**
 * The legend's two lines, `{ tokens, categories }`, each `[{ name, colour }]`: the three bar parts, then the
 * categories of `toolCalls` in the site-wide order of `categoryColours`, the ones folded into the Other colour as one
 * entry.
 */
export function legendEntries(toolCalls, categoryColours) {
  return { tokens: tokenPartEntries(), categories: categoryEntries(toolCalls, categoryColours) };
}

/** The legend for the chips' `toolCalls` and their colours `categoryColours`, with the bar parts, as one element. */
export function requestLegend(toolCalls, categoryColours) {
  const { tokens, categories } = legendEntries(toolCalls, categoryColours);
  const legend = document.createElement("div");
  legend.append(legendLine("Tokens", tokens));
  if (categories.length > 0) {
    legend.append(legendLine("Tool calls", categories));
  }
  return legend;
}
