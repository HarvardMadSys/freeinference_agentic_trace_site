/**
 * The knee-lines kind: the cost of the cache simulation's TTL-only policy against its TTL, on a log axis of TTLs,
 * stacked by part as a multiple of a one-minute TTL's cost, a dashed line at that one-minute cost, and one TTL called
 * out on its stack: the knee, or the lowest total.
 *
 * Its rows are a cost query's: one TTL and part per row, `ttl` (the TTL's name), `ttl_seconds`, `part`,
 * `cost_multiple` (the part's cost at the TTL) and `total_multiple` (the TTL's total), the TTLs in order; a column the
 * figure names marks the TTL called out.
 */

import {
  AXIS_STYLE, chartFrame, colourScale, DASH, GRID_STYLE, LINE_LABEL_STYLE, LINE_WIDTH, X_INSET,
} from "../shared/charts.js";
import { axisWithTicks, TICK_COUNT } from "../axes/ticks.js";
import { formatMultiple, formatMultipleTick, formatTtlName, MULTIPLE_DECIMALS } from "../shared/format.js";
import { seriesLegend, shownRows } from "../shared/series.js";

const PART_COLUMN = "part"; // the column of a cost query naming each row's part
const AXIS_TTLS = Object.freeze(["1s", "1m", "1h", "1d"]); // the TTLs the axis names, with room between them
const AXIS_HEADROOM = 1.1; // the cost axis ends a tenth above the highest stack, as the paper's does
const ONE_MINUTE_COST = 1; // every cost is a multiple of a one-minute TTL's, so the dashed line is drawn at 1×
const CALLOUT_RADIUS = 5; // pixels; the hollow marker on the TTL called out
const CALLOUT_RISE_SHARE = 0.45; // the callout's text sits this share of the cost axis above it, as the paper's does

/**
 * Draw `rows` into `body`: an area per part of `parts` the rows hold and `hidden` does not, stacked bottom up in that
 * order over the TTLs, each in its colour of `colours.series` (a Map from part to colour), with a tooltip per TTL. Its
 * named parameters:
 * - `parts`: each part's name in the rows with its label, in the stack's order, bottom up.
 * - `calloutColumn`: the column marking the TTL called out, true on its rows.
 * - `calloutText(total, ttl)`: the callout's text, from the TTL's total and name as they are written.
 */
export async function drawKneeLines(rows, body, colours, { parts, calloutColumn, calloutText }, hidden) {
  // Plot is loaded here, not at the top, so node can test this module's pure functions.
  const { Plot } = await import("../shared/libraries.js");
  const shown = shownRows(rows, PART_COLUMN, hidden);
  const drawnParts = Object.keys(parts).filter((part) => shown.some((row) => row[PART_COLUMN] === part));
  const stacks = costStacks(shown, parts);
  const callout = calloutPoint(shown, stacks, calloutColumn, calloutText);
  const highestCost = Math.max(...stacks.map((stack) => stack.top)) * AXIS_HEADROOM;
  const ttlTicks = axisTtls(stacks);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { type: "log", domain: [stacks[0].seconds, stacks[stacks.length - 1].seconds], inset: X_INSET },
    y: { domain: [0, highestCost] },
    color: colourScale(colours.series, drawnParts),
    marks: [
      Plot.gridX([...ttlTicks.keys()], GRID_STYLE),
      Plot.gridY({ ...GRID_STYLE, ticks: TICK_COUNT }),
      axisWithTicks(Plot.axisX, [...ttlTicks.keys()], {
        ...AXIS_STYLE, label: "Cache TTL", tickFormat: (seconds) => ttlTicks.get(seconds),
      }),
      Plot.axisY({ ...AXIS_STYLE, label: null, ticks: TICK_COUNT, tickFormat: formatMultipleTick }),
      Plot.areaY(shown, { x: "ttl_seconds", y: "cost_multiple", fill: PART_COLUMN, order: drawnParts }),
      Plot.ruleY([ONE_MINUTE_COST], { ...AXIS_STYLE, strokeDasharray: DASH }),
      ...calloutMarks(Plot, callout, highestCost),
      Plot.tip(stacks, Plot.pointerX({ x: "seconds", y: "top", title: "text" })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The legend of a cost figure: `{ series, colours }`, the parts of `colours` (a Map from part to colour, in the order
 * the legend lists them) that the rows hold, each labelled by `parts` (part to label).
 */
export function kneeLinesLegend(rows, colours, { parts }) {
  return seriesLegend(rows, PART_COLUMN, colours, parts);
}

/**
 * Per TTL of a cost query's rows, in their order: `{ seconds, ttl, top, text }`, `top` the sum of its parts' multiples
 * (the top of the stack) and `text` its tooltip, naming its multiple of each part of `parts` (part to label) the rows
 * hold, top of the stack first, and the TTL's total of every part.
 */
export function costStacks(rows, parts) {
  const rowsByTtl = new Map();
  for (const row of rows) {
    if (!rowsByTtl.has(row.ttl)) {
      rowsByTtl.set(row.ttl, []);
    }
    rowsByTtl.get(row.ttl).push(row);
  }
  const stacks = [];
  for (const [ttl, ttlRows] of rowsByTtl) {
    const lines = [`TTL ${formatTtlName(ttl)}`];
    let top = 0;
    for (const part of Object.keys(parts).reverse()) {
      const row = ttlRows.find((one) => one[PART_COLUMN] === part);
      if (row !== undefined) {
        lines.push(`${parts[part]} ${formatMultiple(row.cost_multiple, MULTIPLE_DECIMALS)}`);
        top += row.cost_multiple;
      }
    }
    lines.push(`Total ${formatMultiple(ttlRows[0].total_multiple, MULTIPLE_DECIMALS)}`);
    stacks.push({ seconds: ttlRows[0].ttl_seconds, ttl, top, text: lines.join("\n") });
  }
  return stacks;
}

/**
 * The TTL called out, the one whose rows are marked in `calloutColumn`: `{ seconds, top, text }`, at the top of its
 * stack, its text written by `calloutText(total, ttl)`; null when no drawn TTL is marked.
 */
export function calloutPoint(rows, stacks, calloutColumn, calloutText) {
  const marked = rows.find((row) => row[calloutColumn]);
  if (marked === undefined) {
    return null;
  }
  const stack = stacks.find((one) => one.ttl === marked.ttl);
  const text = calloutText(formatMultiple(marked.total_multiple, MULTIPLE_DECIMALS), formatTtlName(marked.ttl));
  return { seconds: stack.seconds, top: stack.top, text };
}

/** The TTLs the axis names, of those `stacks` draws: a Map from each one's seconds to its name. */
export function axisTtls(stacks) {
  const names = new Map();
  for (const stack of stacks) {
    if (AXIS_TTLS.includes(stack.ttl)) {
      names.set(stack.seconds, formatTtlName(stack.ttl));
    }
  }
  return names;
}

/**
 * The callout's marks, none without one: a hollow marker on the top of its stack, and a straight leader up from it to
 * its text, a share of the axis's `highestCost` higher, on a halo of the card's colour.
 */
function calloutMarks(Plot, callout, highestCost) {
  if (callout === null) {
    return [];
  }
  const placed = [{ ...callout, textAt: callout.top + CALLOUT_RISE_SHARE * highestCost }];
  const ink = { stroke: "var(--chart-label)", fill: "var(--color-surface)" };
  return [
    Plot.ruleX(placed, { x: "seconds", y1: "top", y2: "textAt", stroke: "var(--chart-label)" }),
    Plot.dot(placed, { x: "seconds", y: "top", r: CALLOUT_RADIUS, strokeWidth: LINE_WIDTH, ...ink }),
    // On a halo of the card's colour, so that no area crosses the text.
    Plot.text(placed, { x: "seconds", y: "textAt", text: "text", lineAnchor: "bottom", ...LINE_LABEL_STYLE }),
  ];
}
