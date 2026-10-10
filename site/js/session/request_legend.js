/** The legend of the Requests view: the colours of a bar's parts, and of the tool categories of the chips. */

import { OTHER_SERIES, TOKEN_PART_COLOURS } from "../shared/charts.js";

// The name the legend gives every category past the eighth, which all share the Other colour.
const OTHER_CATEGORIES = "Other categories";

/**
 * The legend's two lines, `{ tokens, categories }`, each `[{ name, colour }]`: the bar parts (with "no cache
 * report" only when a request has no cache reads), then each category of `categoryColours` in its order, the
 * categories folded into the Other colour as one entry.
 */
export function legendEntries(requests, categoryColours) {
  const tokens = [
    { name: "cached input", colour: TOKEN_PART_COLOURS.cached },
    { name: "uncached input", colour: TOKEN_PART_COLOURS.uncached },
    { name: "output", colour: TOKEN_PART_COLOURS.output },
  ];
  if (requests.some((request) => request.cache_read_tokens === null)) {
    tokens.push({ name: "input, no cache report", colour: OTHER_SERIES });
  }
  const categories = [];
  for (const [category, colour] of categoryColours) {
    if (colour !== OTHER_SERIES) {
      categories.push({ name: category, colour });
    }
  }
  if ([...categoryColours.values()].includes(OTHER_SERIES)) {
    categories.push({ name: OTHER_CATEGORIES, colour: OTHER_SERIES });
  }
  return { tokens, categories };
}

/** The legend for `requests` and the chip colours `categoryColours`, as one element. */
export function requestLegend(requests, categoryColours) {
  const { tokens, categories } = legendEntries(requests, categoryColours);
  const legend = document.createElement("div");
  legend.append(legendLine("Tokens", tokens));
  if (categories.length > 0) {
    legend.append(legendLine("Tool calls", categories));
  }
  return legend;
}

function legendLine(title, entries) {
  const line = document.createElement("p");
  line.className = "legend";
  const heading = document.createElement("span");
  heading.className = "legend-title";
  heading.textContent = title;
  line.append(heading);
  for (const entry of entries) {
    const item = document.createElement("span");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-dash";
    swatch.style.background = entry.colour;
    item.append(swatch, entry.name);
    line.append(item);
  }
  return line;
}
