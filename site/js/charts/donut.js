/**
 * The donut kind: one ring segment per slice, clockwise from the top, largest first and "Other" last, with the slices'
 * total in the centre. A slice is a name with one of the eight series colours, its count summed over the rows; every
 * other name is summed into "Other". Its legend lists the slices with their shares, and a hidden slice leaves the
 * donut, whose shares and total are then of the slices shown.
 *
 * Its rows hold a name and a count, in columns the figure names; one name may have many rows, as one per week. The
 * arithmetic below (shares, angles and SVG paths, clockwise from the top, the donut centred on the origin) is plain
 * functions, tested with `node --test`.
 */

import { chartName, columnTotal } from "../shared/charts.js";
import { formatCount, formatShare } from "../shared/format.js";
import { OTHER_NAME, SERIES_SLOTS } from "../theme/colours.js";

const FULL_TURN = 2 * Math.PI;

// The donut's size in the SVG's own units, which the page scales to the card: the outer and inner radii.
const OUTER_RADIUS = 100;
const INNER_RADIUS = 62;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

// A slice this close to the full turn is drawn as a whole ring: an arc whose ends meet would draw nothing.
const WHOLE_RING_TOLERANCE = 1e-9;

/**
 * Draw `rows` into `body` as a donut of the slices not in `hidden`, each in its colour of `colours.series` (a Map from
 * name to colour, the eight series colours first, as `barColours` gives them), with a tooltip of its name, share and
 * count, and the slices' total in the centre. Its named parameters:
 * - `nameColumn` and `countColumn`: the columns holding a row's name and its count.
 * - `unit`: what the count counts, in the plural, "requests", written under the total.
 * - `totalFormat`: how the total in the centre is written.
 * - `labels`: each name's label where it is written otherwise, in the tooltip and the legend.
 */
export function drawDonut(rows, body, colours, parameters, hidden) {
  const { nameColumn, countColumn, unit, totalFormat, labels = {} } = parameters;
  const slices = donutSlices(rows, nameColumn, countColumn, namedSeries(colours.series));
  const shown = slices.filter((slice) => !hidden.has(slice.name));
  const centre = centreUnit(unit, hidden.size);
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("viewBox", `${-OUTER_RADIUS} ${-OUTER_RADIUS} ${2 * OUTER_RADIUS} ${2 * OUTER_RADIUS}`);
  svg.setAttribute("class", "donut");
  svg.setAttribute("role", "img");
  let total = 0;
  for (const arc of donutArcs(shown, OUTER_RADIUS, INNER_RADIUS)) {
    svg.append(slicePath(arc, colours.series, sliceName(arc.name, labels), centre));
    total += arc.count;
  }
  // Named by its card's title and caption, as every chart is; the total in the centre is read as its text.
  svg.setAttribute("aria-label", chartName(body));
  const value = svgElement("text", { y: "-0.15em", class: "donut-total" });
  value.textContent = totalFormat(total);
  const under = svgElement("text", { y: "1.35em", class: "donut-unit" });
  under.textContent = centre;
  svg.append(value, under);
  body.replaceChildren(svg);
}

/**
 * The legend of a donut: `{ series, colours }`, its slices in the donut's order, largest first, each labelled with its
 * name, as `labels` writes it where it has a label there, and its share of every slice, "glm-5.3-flash 44.0%"; and
 * `colours`, the donut's colours.
 */
export function donutLegend(rows, colours, { nameColumn, countColumn, labels = {} }) {
  const slices = donutSlices(rows, nameColumn, countColumn, namedSeries(colours));
  return { series: legendSeries(slices, labels), colours };
}

/**
 * The donut's slices `[{ name, count }]` of `rows`: `row[countColumn]` summed by `row[nameColumn]`, a name among the
 * first eight of `order` keeping its own slice and every other name summed into "Other". The named slices come largest
 * first, "Other" last; a name with no rows has no slice.
 */
export function donutSlices(rows, nameColumn, countColumn, order) {
  const named = order.slice(0, SERIES_SLOTS.length);
  const counts = new Map();
  for (const row of rows) {
    const name = named.includes(row[nameColumn]) ? row[nameColumn] : OTHER_NAME;
    counts.set(name, (counts.get(name) ?? 0) + row[countColumn]);
  }
  const slices = [];
  for (const name of named) {
    if (counts.has(name)) {
      slices.push({ name, count: counts.get(name) });
    }
  }
  slices.sort((first, second) => second.count - first.count);
  if (counts.has(OTHER_NAME)) {
    slices.push({ name: OTHER_NAME, count: counts.get(OTHER_NAME) });
  }
  return slices;
}

/**
 * The legend's entries `[{ name, label }]` of `slices`, each labelled with its name, as `labels` writes it where it has
 * a label there, and its share of them: "glm-5.3-flash 44.0%".
 */
export function legendSeries(slices, labels = {}) {
  const total = columnTotal(slices, "count");
  const entries = [];
  for (const slice of slices) {
    entries.push({ name: slice.name, label: `${sliceName(slice.name, labels)} ${formatShare(slice.count / total)}` });
  }
  return entries;
}

/** A slice's name as the donut writes it: its label where `labels` gives one, else as the release does. */
function sliceName(name, labels) {
  return Object.hasOwn(labels, name) ? labels[name] : name;
}

/** The line under the donut's total: what it counts, "requests", or "shown requests" while `hiddenCount` are hidden. */
export function centreUnit(plural, hiddenCount) {
  return hiddenCount === 0 ? plural : `shown ${plural}`;
}

// The names of `colours` that keep a slice of their own: those before "Other", the first eight of the colour order.
function namedSeries(colours) {
  return [...colours.keys()].filter((name) => name !== OTHER_NAME);
}

// A slice's ring segment, with its tooltip: its name, its share of the slices shown, and its count.
function slicePath(arc, colours, name, unit) {
  const path = svgElement("path", { d: arc.path, fill: colours.get(arc.name), class: "donut-slice" });
  const tooltip = svgElement("title", {});
  tooltip.textContent = `${name}: ${formatShare(arc.share)} of ${unit} (${formatCount(arc.count)})`;
  path.append(tooltip);
  return path;
}

function svgElement(name, attributes) {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}

/** Each of `slices` (`[{ name, count }]`) with its `share` of their total count, in their order. */
export function sliceShares(slices) {
  let total = 0;
  for (const slice of slices) {
    total += slice.count;
  }
  return slices.map((slice) => ({ ...slice, share: slice.count / total }));
}

/**
 * The ring segments of `slices` (`[{ name, count }]`) between `innerRadius` and `outerRadius`, in their order,
 * clockwise from the top: each slice with its `share`, its `startAngle` and `endAngle`, and its SVG `path`.
 */
export function donutArcs(slices, outerRadius, innerRadius) {
  const arcs = [];
  let startAngle = 0;
  for (const slice of sliceShares(slices)) {
    const endAngle = startAngle + slice.share * FULL_TURN;
    const path = ringSegmentPath(startAngle, endAngle, outerRadius, innerRadius);
    arcs.push({ ...slice, startAngle, endAngle, path });
    startAngle = endAngle;
  }
  return arcs;
}

/** The point at `angle` (clockwise from the top) on the circle of `radius` round the origin, as "x y". */
export function pointAt(angle, radius) {
  return `${round(radius * Math.sin(angle))} ${round(-radius * Math.cos(angle))}`;
}

/**
 * The SVG path of the ring segment from `startAngle` to `endAngle` between the two radii: along the outer circle,
 * in to the inner one, and back along it. A segment of the full turn is the whole ring, two circles drawn as halves.
 */
export function ringSegmentPath(startAngle, endAngle, outerRadius, innerRadius) {
  if (endAngle - startAngle >= FULL_TURN - WHOLE_RING_TOLERANCE) {
    return wholeRingPath(outerRadius, innerRadius);
  }
  // An arc longer than half the circle needs SVG's large-arc flag, or the shorter way round is drawn.
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return [
    `M ${pointAt(startAngle, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${pointAt(endAngle, outerRadius)}`,
    `L ${pointAt(endAngle, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${pointAt(startAngle, innerRadius)}`,
    "Z",
  ].join(" ");
}

// The whole ring: the outer circle and the inner one, each as two half arcs, filled with the even-odd rule so the
// inner circle is a hole.
function wholeRingPath(outerRadius, innerRadius) {
  const halfTurn = Math.PI;
  return [
    `M ${pointAt(0, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${pointAt(halfTurn, outerRadius)}`,
    `A ${outerRadius} ${outerRadius} 0 1 1 ${pointAt(0, outerRadius)}`,
    `M ${pointAt(0, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${pointAt(halfTurn, innerRadius)}`,
    `A ${innerRadius} ${innerRadius} 0 1 0 ${pointAt(0, innerRadius)}`,
    "Z",
  ].join(" ");
}

// A coordinate to a hundredth of a pixel, so a path's text stays short; -0 is written as 0.
function round(value) {
  return Math.round(value * 100) / 100 + 0;
}
