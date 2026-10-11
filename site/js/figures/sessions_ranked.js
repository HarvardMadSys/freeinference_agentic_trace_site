/**
 * The Sessions figures that rank sessions by a share and stack each rank bin's mean shares: how a session's cost
 * splits between its token parts, and how its time splits between the model, tools and people.
 *
 * Each figure is a figure entry, whose fields CONTRIBUTING.md defines. Every row of their queries is one rank bin:
 * its `percentile` (the bin's middle, in percent of the sessions ranked), one column per part holding the bin's mean
 * share of it, and `bin_sessions`, the bin's sessions. Every row also holds the same `ranked_bin` and `rows`, the
 * sessions ranked: the page counts the figure's rows as one bin, so the figure is hidden only when the whole selection
 * has too few sessions, not when its rank bins are small. The parts are columns, not rows, so a figure's draw function
 * is given the parts its legend hides.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, TIP_STYLE } from "../shared/charts.js";
import { causeColours, REQUEST_PART_COLOURS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { formatCount, formatShare } from "../shared/format.js";

// The parts of a session's cost, bottom up in the stack, with the label each is drawn under.
const COST_PARTS = Object.freeze({ cached: "Cached input", uncached: "Uncached input", output: "Output" });

// The parts of a session's time, bottom up in the stack, with the label each is drawn under.
const TIME_PARTS = Object.freeze({ model: "Model", tool: "Tools", human: "Human" });

const PERCENTILE_DOMAIN = Object.freeze([0, 100]); // the x axis spans every ranked session, whatever bins are hidden
const SHARE_DOMAIN = Object.freeze([0, 1]); // the y axis spans a whole share, whatever parts are hidden

/** The cost share figure: each session's cost split between its token parts, sessions ranked by cached share. */
export const COST_SHARE_BY_SESSION = Object.freeze({
  name: "cost_share_by_session",
  title: "Cost share by session",
  definition: "Each top-level session's cost at the pipeline's prices (cached 1, uncached 10, output 50 per token), over its requests whose provider reports cache reads and that have an input, split between cached input, uncached input and output, with the sessions ranked by cached share and each rank bin's mean shares stacked.",
  query: "figures/cost_share_by_session",
  binColumn: "ranked_bin",
  seriesOverSameRows: true,
  legend: costShareLegend,
  draw: drawCostShare,
});

/** The session time figure: each session's time split between the model, tools and people, ranked by human share. */
export const SESSION_TIME_BY_PART = Object.freeze({
  name: "session_time_by_part",
  title: "Session time by part",
  definition: "Each top-level session's time split between model time (its requests' latencies), tool time (its waits for a tool or a subagent) and human time (its waits for the user or an ask-user tool), with the sessions ranked by human share and each rank bin's mean shares stacked; the paper splits model time into prefill and decode, the site does not.",
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

/** The legend of a figure whose parts are columns: each part of `labels` (part to label), in its colour of `colours`. */
export function partsLegend(labels, colours) {
  const series = Object.entries(labels).map(([name, label]) => ({ name, label }));
  return { series, colours };
}

/** The cost share's legend: cached input, uncached input and output, in their token colours. */
function costShareLegend() {
  return partsLegend(COST_PARTS, new Map(Object.entries(TOKEN_PART_COLOURS)));
}

/**
 * The session time's legend: model time in the ink of a request on the Session page's Timeline, and tool and human
 * time in the colours the Timeline gives a wait for a tool and for the user.
 */
function sessionTimeLegend() {
  const waits = causeColours();
  const colours = new Map([["model", REQUEST_PART_COLOURS.whole], ["tool", waits.get("tool")], ["human", waits.get("user")]]);
  return partsLegend(TIME_PARTS, colours);
}

/** Draw the cost share's rank bins as a stacked area of cached, uncached and output shares; hidden parts left out. */
async function drawCostShare(rows, body, colours, hidden) {
  await drawRankedShares(body, rows, {
    labels: COST_PARTS,
    colours: colours.series,
    hidden,
    xLabel: "Sessions ranked by cached share (percentile)",
    yLabel: "Share of cost",
  });
}

/** Draw the session time's rank bins as a stacked area of model, tool and human shares; hidden parts left out. */
async function drawSessionTime(rows, body, colours, hidden) {
  await drawRankedShares(body, rows, {
    labels: TIME_PARTS,
    colours: colours.series,
    hidden,
    xLabel: "Sessions ranked by human share (percentile)",
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
      Plot.axisX({ ...AXIS_STYLE, label: xLabel }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: "%", label: yLabel }),
      Plot.areaY(stackedSharePoints(rows, shown), { x: "percentile", y: "share", fill: "part", order: shown }),
      Plot.tip(tips, Plot.pointerX({ ...TIP_STYLE, x: "percentile", y: "top", title: "text" })),
    ],
  });
  body.replaceChildren(chart);
}
