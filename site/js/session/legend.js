/** The legends of the Session page's views: a titled line of colour swatches, and the tool categories' entries. */

import { OTHER_NAME, OTHER_SERIES } from "../theme/colours.js";

/**
 * The legend entries `[{ name, colour }]` of the categories of `toolCalls`, in the site-wide order of
 * `categoryColours` (a map from each category to its tool group's colour), the ones in the Other grey, the category
 * Other among them, as one entry "Other", last.
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
    categories.push({ name: OTHER_NAME, colour: OTHER_SERIES });
  }
  return categories;
}

/**
 * A legend line: `title` (none when null), then a swatch and a name per entry of `entries`,
 * `[{ name, colour, opacity, shape }]`;
 * `opacity` is the swatch's opacity, for a series drawn lighter, and is left out for a solid one; `shape` is the
 * swatch's shape, as the chart draws the entry: a bar for an area or a bar (the default), "line", "dot" or "dotted"
 * for a dotted rule.
 */
export function legendLine(title, entries) {
  const line = document.createElement("p");
  line.className = "legend";
  if (title !== null) {
    const heading = document.createElement("span");
    heading.className = "legend-title";
    heading.textContent = title;
    line.append(heading);
  }
  for (const entry of entries) {
    const item = document.createElement("span");
    item.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = entry.shape === undefined ? "legend-dash" : `legend-dash is-${entry.shape}`;
    swatch.style.color = entry.colour; // a dotted rule draws its dots in this colour
    swatch.style.background = entry.shape === "dotted" ? "none" : entry.colour;
    if (entry.opacity !== undefined) {
      swatch.style.opacity = String(entry.opacity);
    }
    item.append(swatch, entry.name);
    line.append(item);
  }
  return line;
}
