/**
 * The stat strip: a row of tiles, each a label, a value and a line of detail, as the Explore page's headline and the
 * Session page's facts show them.
 */

/**
 * A stat strip of `tiles`, `[{ label, value, detail, definition, isWide }]`: `label`, `value` and `detail` strings, a
 * detail's line breaks kept; `definition`, when a tile has one, its hover text; and `isWide`, when true, a tile two
 * columns wide.
 */
export function statStrip(tiles) {
  const strip = document.createElement("div");
  strip.className = "stat-strip";
  for (const tile of tiles) {
    strip.append(statTile(tile));
  }
  return strip;
}

function statTile({ label, value, detail, definition, isWide = false }) {
  const element = document.createElement("div");
  element.className = isWide ? "stat is-wide" : "stat";
  if (definition !== undefined) {
    element.title = definition;
  }
  element.append(tileLine("stat-label", label), tileLine("stat-value", value), tileLine("stat-detail", detail));
  return element;
}

function tileLine(className, text) {
  const line = document.createElement("div");
  line.className = className;
  line.textContent = text;
  return line;
}
