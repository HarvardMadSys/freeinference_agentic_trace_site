/**
 * The tool mix along a turn: per tenth of a turn, the share of calls in each of the pipeline's eight tool groups, one
 * panel for the human-driven sessions and one for the benchmark's; listed in the Tools section (`figures/tools.js`).
 *
 * Every row of its query is one scope, tenth and group with calls: `scope` (`Agentic` or `SWE-Bench`), `tenth`
 * (0 to 9), `tool_group`, its `calls`, their `share` of the tenth's calls, and `rows`, the scope's calls, so a scope
 * with too few calls is hidden whole. A group a tenth has no call of has no row and is drawn as a share of zero.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE } from "../shared/charts.js";
import { isNarrowChart, percentTick } from "../axes/ticks.js";
import { TOOL_GROUP_COLOURS } from "../theme/colours.js";
import { formatPercent, formatShare } from "../shared/format.js";
import { seriesLegend } from "../figures/figure_rows.js";
import { SCOPE_LABELS, SCOPES } from "./scopes.js";

/** The tenths a turn is cut into; each tenth's share is drawn flat across it, from 0% to 100% of the turn. */
export const TENTHS = 10;
const WHOLE_TURN_PERCENT = 100;
const PERCENT_PER_TENTH = WHOLE_TURN_PERCENT / TENTHS;

// The ticks of a panel's axis, in percent of the turn: its start, middle and end, the panels far enough apart that
// one's "100%" and the next one's "0%" do not meet; on a narrow chart the middle alone, since they would.
const TURN_TICKS = Object.freeze([0, 50, 100]);
const NARROW_TURN_TICKS = Object.freeze([50]);
const NARROW_TITLE_WIDTH = 6; // ems; on a narrow chart a panel's title wraps at this width ("Human-/driven")
const PANEL_GAP = 0.18; // the share of a panel's width left between the two panels
const SHARE_DOMAIN = Object.freeze([0, 1]); // the y axis spans a whole share, whatever groups are hidden
const PANEL_TITLE_MARGIN = 44; // pixels above the panels: room for their titles clear of the share axis's "100%"
const PANEL_TITLE_RISE = 18; // pixels between a panel's top and its title, which starts at the panel's left edge

/** The tool mix figure entry, whose fields CONTRIBUTING.md defines. */
export const TOOL_MIX_BY_TURN_POSITION = Object.freeze({
  name: "tool_mix_by_turn_position",
  title: "Tool mix along a turn",
  insight: "Real coding doesn't follow the neat workflow seen in benchmarks.",
  definition: "Each panel divides a turn into ten equal stages and shows each tool group’s percentage of calls, for human sessions and SWE-Bench. Only main sessions count. Shell file operations are grouped by whether they read files, change files, or do neither.",
  caption: "SWE-Bench turns shift from reading and searching toward execution and testing. Human-driven turns maintain a more varied mix of tool operations throughout execution.",
  isWide: true,
  query: "figures/tool_mix_by_turn_position",
  binColumn: "scope",
  seriesNouns: Object.freeze({ Agentic: "human-driven calls", "SWE-Bench": "benchmark calls" }),
  seriesColumn: "tool_group",
  legend: (rows, colours, seriesColumn) =>
    seriesLegend(rows, seriesColumn, new Map(Object.entries(TOOL_GROUP_COLOURS))),
  draw: drawToolMix,
});

/**
 * The points of the stacked areas: one `{ scope, tenth, turnPercent, group, share }` per scope of the rows, tenth and
 * group of `groups`, in that order; a share of zero where the rows hold none. `turnPercent` is the tenth's middle.
 */
export function toolMixPoints(rows, groups) {
  const shares = new Map(rows.map((row) => [shareKey(row.scope, row.tenth, row.tool_group), row.share]));
  const points = [];
  for (const scope of scopesOf(rows)) {
    for (let tenth = 0; tenth < TENTHS; tenth += 1) {
      for (const group of groups) {
        const share = shares.get(shareKey(scope, tenth, group)) ?? 0;
        points.push({ scope, tenth, turnPercent: (tenth + 0.5) * PERCENT_PER_TENTH, group, share });
      }
    }
  }
  return points;
}

/**
 * The tooltip of each scope's tenth: `{ scope, turnPercent, top, text }`, `top` the sum of its points' shares (the top
 * of the stack, where the tooltip points) and `text` naming the tenth and each group's share, top of the stack first.
 */
export function toolMixTips(points) {
  const tips = new Map();
  for (const point of points) {
    const key = tenthKey(point.scope, point.tenth);
    if (!tips.has(key)) {
      const heading = `${SCOPE_LABELS[point.scope]}, ${tenthText(point.tenth)} of the turn`;
      tips.set(key, { scope: point.scope, turnPercent: point.turnPercent, top: 0, lines: [heading] });
    }
    const tip = tips.get(key);
    tip.top += point.share;
    tip.lines.splice(1, 0, `${point.group}: ${formatShare(point.share)}`); // after the heading, above the group below
  }
  const drawn = [];
  for (const { scope, turnPercent, top, lines } of tips.values()) {
    drawn.push({ scope, turnPercent, top, text: lines.join("\n") });
  }
  return drawn;
}

/** Draw each scope's shares as a stacked area per tenth, its groups bottom up in the legend's order. */
async function drawToolMix(rows, body, colours) {
  // Plot is loaded here, not at the top, so node can test the section's figure list.
  const { Plot } = await import("../shared/libraries.js");
  const present = new Set(rows.map((row) => row.tool_group));
  const groups = [...colours.series.keys()].filter((group) => present.has(group));
  const points = toolMixPoints(rows, groups);
  const frame = { ...chartFrame(body), marginTop: PANEL_TITLE_MARGIN };
  const chart = Plot.plot({
    ...frame,
    fx: { domain: scopesOf(rows), axis: null, padding: PANEL_GAP },
    x: { domain: [0, WHOLE_TURN_PERCENT] },
    y: { domain: SHARE_DOMAIN },
    color: colourScale(colours.series, groups),
    marks: [
      // Each panel's title at its own left edge, lifted clear of the share axis's top label; wrapped on a narrow
      // chart, growing upward, so that the first does not run into the second.
      Plot.text(scopesOf(rows), {
        fx: (scope) => scope, text: scopeLabel, frameAnchor: "top-left", textAnchor: "start", lineAnchor: "bottom",
        dy: -PANEL_TITLE_RISE / 2, lineWidth: isNarrowChart(frame.width) ? NARROW_TITLE_WIDTH : Infinity,
        fill: "var(--chart-label)",
      }),
      Plot.gridY(GRID_STYLE),
      Plot.axisX({
        ...AXIS_STYLE, ticks: turnTicks(frame.width), tickFormat: percentTick, label: "Position in the turn",
      }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatPercent, label: null }), // the caption says these are shares of calls
      Plot.areaY(stepPoints(points), {
        fx: "scope", x: "turnPercent", y: "share", fill: "group", order: groups, curve: "step-after",
      }),
      Plot.tip(toolMixTips(points), Plot.pointerX({
        fx: "scope", x: "turnPercent", y: "top", title: "text",
      })),
    ],
  });
  body.replaceChildren(chart);
}

/**
 * The points a stepped area draws for `points`: each tenth's share from the tenth's start, and the last tenth's again at
 * the turn's end, so that each share spans its whole tenth.
 */
export function stepPoints(points) {
  const steps = [];
  for (const point of points) {
    steps.push({ ...point, turnPercent: point.tenth * PERCENT_PER_TENTH });
    if (point.tenth === TENTHS - 1) {
      steps.push({ ...point, turnPercent: WHOLE_TURN_PERCENT });
    }
  }
  return steps;
}

/** The ticks of each panel's axis on a chart `width` pixels wide, in percent of the turn. */
export function turnTicks(width) {
  return isNarrowChart(width) ? NARROW_TURN_TICKS : TURN_TICKS;
}

/** The scopes the rows hold, in the order their panels are drawn. */
function scopesOf(rows) {
  const present = new Set(rows.map((row) => row.scope));
  return SCOPES.filter((scope) => present.has(scope));
}

function shareKey(scope, tenth, group) {
  return `${tenthKey(scope, tenth)}|${group}`;
}

function tenthKey(scope, tenth) {
  return `${scope}|${tenth}`;
}

function scopeLabel(scope) {
  return SCOPE_LABELS[scope];
}

function tenthText(tenth) {
  return `${tenth * PERCENT_PER_TENTH}–${(tenth + 1) * PERCENT_PER_TENTH}%`;
}
