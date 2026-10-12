/**
 * The stat strip: a row of tiles, each a label, a value and a line of detail, as the Explore page's headline and the
 * Session page's facts show them.
 */

/**
 * A stat strip of `tiles`, `[{ label, value, detail, definition, isWide }]`: `label` and `value` strings; `detail` a
 * string, or a list of lines `[{ text, note }]` each with its `note` muted; `definition`, when a tile has one, its
 * hover text; and `isWide`, when true, a tile two columns wide.
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
  const detailLine = Array.isArray(detail) ? detailLines(detail) : tileLine("stat-detail", detail);
  element.append(tileLine("stat-label", label), tileLine("stat-value", value), detailLine);
  return element;
}

// A detail of several lines, each its text and, muted, its note.
function detailLines(lines) {
  const element = document.createElement("div");
  element.className = "stat-detail";
  for (const { text, note } of lines) {
    const line = tileLine("stat-detail-line", `${text} `);
    const muted = document.createElement("span");
    muted.className = "stat-detail-note";
    muted.textContent = note;
    line.append(muted);
    element.append(line);
  }
  return element;
}

function tileLine(className, text) {
  const line = document.createElement("div");
  line.className = className;
  line.textContent = text;
  return line;
}
