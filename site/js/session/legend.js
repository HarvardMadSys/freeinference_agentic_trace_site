/** The legends of the Session page's views: a titled line of colour swatches, and the tool categories' entries. */

import { OTHER_SERIES } from "../theme/colours.js";

// The name the legend gives every category past the eighth, which all share the Other colour. It is not the charts'
// "Other": the data has a tool category of that name, which holds its own colour.
const OTHER_CATEGORIES = "Other categories";

/**
 * The legend entries `[{ name, colour }]` of the categories of `toolCalls`, in the site-wide order of
 * `categoryColours` (a map from each category to its colour), the ones folded into the Other colour as one entry.
 */
export function categoryEntries(toolCalls, categoryColours) {
  const called = new Set(toolCalls.map((call) => call.category));
  const categories = [];
  let hasFolded = false;
  for (const [category, colour] of categoryColours) {
    if (!called.has(category)) {
      continue;
    }
    if (colour === OTHER_SERIES) {
      hasFolded = true;
    } else {
      categories.push({ name: category, colour });
    }
  }
  if (hasFolded) {
    categories.push({ name: OTHER_CATEGORIES, colour: OTHER_SERIES });
  }
  return categories;
}

/**
 * A legend line: `title`, then a swatch and a name per entry of `entries`, `[{ name, colour, opacity }]`; `opacity`
 * is the swatch's opacity, for a series drawn lighter, and is left out for a solid one.
 */
export function legendLine(title, entries) {
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
    if (entry.opacity !== undefined) {
      swatch.style.opacity = String(entry.opacity);
    }
    item.append(swatch, entry.name);
    line.append(item);
  }
  return line;
}
