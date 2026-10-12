/**
 * The figures that rank sessions by a share and stack each rank bin's mean shares: how a session's cost splits between
 * its token parts, listed in `tokens.js`, and how its time splits between prefill, decode, tool wait and user idle, listed
 * in `latency.js`.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of their queries is one rank bin:
 * its `percentile` (the bin's middle, in percent of the sessions ranked), one column per part holding the bin's mean
 * share of it, and `bin_sessions`, the bin's sessions. Every row also holds the same `ranked_bin` and `rows`, the
 * sessions ranked: the page counts the figure's rows as one bin, so the figure is hidden only when the whole selection
 * has too few sessions, not when its rank bins are small. The parts are columns, not rows, so a figure's draw function
 * is given the parts its legend hides.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, TIP_STYLE } from "../shared/charts.js";
import { TIME_PART_COLOURS, TIME_PART_NAMES, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { formatCount, formatPercent, formatShare } from "../shared/format.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";
import { partsLegend } from "./figure_rows.js";

// The parts of a session's cost, bottom up in the stack, with the label each is drawn under.
const COST_PARTS = TOKEN_PART_NAMES;

// The parts of a session's time, bottom up in the stack as the paper stacks them, with the label each is drawn under.
const TIME_PARTS = TIME_PART_NAMES;

const PERCENTILE_DOMAIN = Object.freeze([0, 100]); // the x axis spans every ranked session, whatever bins are hidden
const SHARE_DOMAIN = Object.freeze([0, 1]); // the y axis spans a whole share, whatever parts are hidden

/** The cost share figure: each session's cost split between its token parts, sessions ranked by cached share. */
export const COST_SHARE_BY_SESSION = Object.freeze({
  name: "cost_share_by_session",
  title: "Cost share by session",
  insight: "Cache reads are most of the API bill.",
  definition: "Each top-level session's cost at the pipeline's prices (cached 1, uncached 10, output 50 per token), over requests reporting cache reads, split by token kind, sessions ranked by cached share and each rank bin's mean shares stacked.",
  caption: "Each session's cost by token kind, sessions ranked by cached share.",
  query: "figures/cost_share_by_session",
  binColumn: "ranked_bin",
  seriesOverSameRows: true,
  legend: costShareLegend,
  draw: drawCostShare,
});

/** The session time figure: each session's time in prefill, decode, tool wait and user idle, ranked by idle share. */
export const SESSION_TIME_BY_PART = Object.freeze({
  name: "session_time_by_part",
  title: "Session time by part",
  insight: "Half a session is user thinking; tools take most of the rest.",
  definition: "Each top-level session's time as prefill, decode, tool waits (for a tool or subagent) and user idle (waits for the user or an ask-user tool), sessions ranked by user-idle share, each rank bin's mean shares stacked.",
  caption: "Each session's time in prefill, decode, tool wait and user idle.",
  query: "figures/session_time_by_part",
  binColumn: "ranked_bin",
  seriesOverSameRows: true,
  legend: sessionTimeLegend,
  draw: drawSessionTime,
});

/**
 * The points of a stacked area of rank bins: one `{ part, percentile, share }` per part of `parts` (column names of
 * the rows) and row, each part's points in the rows' order.
 */
export function stackedSharePoints(rows, parts) {
  const points = [];
  for (const part of parts) {
    for (const row of rows) {
      points.push({ part, percentile: row.percentile, share: row[part] });
    }
  }
  return points;
}

/**
 * The tooltip of each rank bin: `{ percentile, top, text }`, `top` the sum of its shares of `parts` (the top of the
 * stack, where the tooltip points) and `text` naming each part by its label in `labels`, its share, and the bin's
 * sessions (`bin_sessions`).
 */
export function rankTips(rows, parts, labels) {
  const tips = [];
  for (const row of rows) {
    const lines = [`Percentile ${row.percentile.toFixed(1)}`];
    let top = 0;
    for (const part of parts) {
      lines.push(`${labels[part]}: ${formatShare(row[part])}`);
      top += row[part];
    }
    lines.push(`${formatCount(row.bin_sessions)} sessions`);
    tips.push({ percentile: row.percentile, top, text: lines.join("\n") });
  }
  return tips;
}

/** The cost share's legend: cached input, uncached input and output, in their token colours. */
function costShareLegend() {
  return partsLegend(COST_PARTS, new Map(Object.entries(TOKEN_PART_COLOURS)));
}

/** The session time's legend: prefill, decode, tool wait and user idle, in the paper's part colours. */
function sessionTimeLegend() {
  return partsLegend(TIME_PARTS, new Map(Object.entries(TIME_PART_COLOURS)));
}

/** Draw the cost share's rank bins as a stacked area of cached, uncached and output shares; hidden parts left out. */
async function drawCostShare(rows, body, colours, hidden) {
  await drawRankedShares(body, rows, {
    labels: COST_PARTS,
    colours: colours.series,
    hidden,
    xLabel: "Session percentile",
    yLabel: "Share of cost",
  });
}

/** Draw the session time's rank bins as a stacked area of prefill, decode, tool and user shares; hidden left out. */
async function drawSessionTime(rows, body, colours, hidden) {
  await drawRankedShares(body, rows, {
    labels: TIME_PARTS,
    colours: colours.series,
    hidden,
    xLabel: "Session percentile",
    yLabel: "Share of session time",
  });
}

/**
 * Draw `rows`, rank bins, into `body` as a stacked area over the percentile of each part of `labels` (part to label)
 * not in `hidden`, bottom up in that order, each in its colour of `colours`, with a tooltip per bin.
 */
async function drawRankedShares(body, rows, { labels, colours, hidden, xLabel, yLabel }) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const shown = Object.keys(labels).filter((part) => !hidden.has(part));
  const tips = rankTips(rows, shown, labels);
  const chart = Plot.plot({
    ...chartFrame(body),
    x: { domain: PERCENTILE_DOMAIN },
    y: { domain: SHARE_DOMAIN },
    color: colourScale(colours, shown),
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.axisX({ ...AXIS_STYLE, label: xLabel, tickFormat: percentileTick }), // "0%" to "100%", as the y axis
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: yLabel }),
      Plot.areaY(stackedSharePoints(rows, shown), { x: "percentile", y: "share", fill: "part", order: shown }),
      Plot.tip(tips, Plot.pointerX({ ...TIP_STYLE, x: "percentile", y: "top", title: "text" })),
    ],
  });
  body.replaceChildren(chart);
}

function percentileTick(percentile) {
  return `${percentile}%`;
}
