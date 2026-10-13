/** The legends of the Session page's views: a titled line of colour swatches, and the tool categories' entries. */

import { OTHER_NAME, OTHER_SERIES, TOOL_GROUP_OF_CATEGORY } from "../theme/colours.js";

/**
 * The legend entries `[{ name, colour }]` of the categories of `toolCalls`, one per colour, in the site-wide order of
 * `categoryColours` (a map from each category to its colour): named after the category when it is the
 * only one called in its colour, after its tool group when several are (a chip's tooltip names its category); the
 * ones in the Other grey, the category Other among them, as one entry "Other", last.
 */
export function categoryEntries(toolCalls, categoryColours) {
  const called = new Set(toolCalls.map((call) => call.category));
  const categoriesByColour = new Map(); // each colour of a called category, in site-wide order, and its categories
  for (const [category, colour] of categoryColours) {
    if (!called.has(category)) {
      continue;
    }
    if (!categoriesByColour.has(colour)) {
      categoriesByColour.set(colour, []);
    }
    categoriesByColour.get(colour).push(category);
  }
  const entries = [];
  for (const [colour, categories] of categoriesByColour) {
    if (colour !== OTHER_SERIES) {
      entries.push({ name: entryName(categories), colour });
    }
  }
  if (categoriesByColour.has(OTHER_SERIES)) {
    entries.push({ name: OTHER_NAME, colour: OTHER_SERIES });
  }
  return entries;
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

// A colour's entry is named after its one category, or after the tool group its several categories share.
function entryName(categories) {
  return categories.length === 1 ? categories[0] : TOOL_GROUP_OF_CATEGORY[categories[0]];
}
