/**
 * The tool mix along a turn: per tenth of a turn, the share of calls in each of the pipeline's eight tool groups, one
 * panel for the human-driven sessions and one for the benchmark's.
 *
 * Every row of its query is one scope, tenth and group with calls: `scope` (`human-driven` or `benchmark`), `tenth`
 * (0 to 9), `tool_group`, its `calls`, their `share` of the tenth's calls, and `rows`, the scope's calls, so a scope
 * with too few calls is hidden whole. A group a tenth has no call of has no row and is drawn as a share of zero.
 */

import { AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, TIP_STYLE } from "../shared/charts.js";
import { TOOL_GROUP_COLOURS } from "../theme/colours.js";
import { formatShare } from "../shared/format.js";
import { seriesLegend } from "../figures/figure_rows.js";

/** The tenths a turn is cut into; a tenth's area is drawn at its end, from 10% to 100% of the turn. */
export const TENTHS = 10;
const WHOLE_TURN_PERCENT = 100;
const PERCENT_PER_TENTH = WHOLE_TURN_PERCENT / TENTHS;

// The scopes, in the order their panels are drawn, by their name in the query, with the name each panel is drawn under.
const SCOPE_LABELS = Object.freeze({ "human-driven": "Human-driven", benchmark: "Benchmark" });
const SCOPES = Object.freeze(Object.keys(SCOPE_LABELS));

// The ticks of a panel's axis, in percent of the turn: three, or on a narrow chart two, so that the last label of the
// first panel does not run into the first label of the second.
const TURN_TICKS = Object.freeze([10, 50, 100]);
const NARROW_TURN_TICKS = Object.freeze([50, 100]);
const NARROW_CHART_WIDTH = 480; // pixels; a chart narrower than this has room for two labels per panel
const SHARE_DOMAIN = Object.freeze([0, 1]); // the y axis spans a whole share, whatever groups are hidden

/** The tool mix figure entry, whose fields CONTRIBUTING.md defines. */
export const TOOL_MIX_BY_TURN_POSITION = Object.freeze({
  name: "tool_mix_by_turn_position",
  title: "Tool mix along a turn",
  definition: "Per tenth of a turn (a user step and the tool steps after it, whose requests that made a call are numbered k = 0 to n − 1 and fall in the tenth ⌊10 (k + 0.5) / n⌋), the share of the calls of the top-level sessions in each of eight groups of their category, a *File Ops call being Write/Edit when a program it ran changes files, else Read when one only looks, else Other; one panel for the selected harnesses but the benchmark's, one for the benchmark's.",
  caption: "The share of calls in each tool group at each tenth of a turn, human-driven and benchmark.",
  query: "figures/tool_mix_by_turn_position",
  binColumn: "scope",
  seriesNouns: Object.freeze({ "human-driven": "human-driven calls", benchmark: "benchmark calls" }),
  seriesColumn: "tool_group",
  legend: toolGroupLegend,
  draw: drawToolMix,
});

/** The tool mix's legend: the groups of the rows, in the pipeline's order and their own colours. */
export function toolGroupLegend(rows, colours, seriesColumn) {
  return seriesLegend(rows, seriesColumn, new Map(Object.entries(TOOL_GROUP_COLOURS)));
}

/**
 * The points of the stacked areas: one `{ scope, tenth, turnPercent, group, share }` per scope of the rows, tenth and
 * group of `groups`, in that order; a share of zero where the rows hold none. `turnPercent` is the tenth's end.
 */
export function toolMixPoints(rows, groups) {
  const shares = new Map(rows.map((row) => [shareKey(row.scope, row.tenth, row.tool_group), row.share]));
  const points = [];
  for (const scope of scopesOf(rows)) {
    for (let tenth = 0; tenth < TENTHS; tenth += 1) {
      for (const group of groups) {
        const share = shares.get(shareKey(scope, tenth, group)) ?? 0;
        points.push({ scope, tenth, turnPercent: (tenth + 1) * PERCENT_PER_TENTH, group, share });
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
      const heading = `${SCOPE_LABELS[point.scope]}, ${tenthText(point.turnPercent)} of the turn`;
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
  const frame = chartFrame(body);
  const chart = Plot.plot({
    ...frame,
    fx: { domain: scopesOf(rows), tickFormat: scopeLabel, label: null },
    x: { domain: [PERCENT_PER_TENTH, WHOLE_TURN_PERCENT] }, // from the first tenth's end
    y: { domain: SHARE_DOMAIN },
    color: colourScale(colours.series, groups),
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.axisX({
        ...AXIS_STYLE, ticks: turnTicks(frame.width), tickFormat: percentTick, label: "Position in the turn",
      }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: "%", label: null }), // the caption says these are shares of calls
      Plot.areaY(points, { fx: "scope", x: "turnPercent", y: "share", fill: "group", order: groups }),
      Plot.tip(toolMixTips(points), Plot.pointerX({
        ...TIP_STYLE, fx: "scope", x: "turnPercent", y: "top", title: "text",
      })),
    ],
  });
  body.replaceChildren(chart);
}

/** The ticks of each panel's axis on a chart `width` pixels wide, in percent of the turn. */
export function turnTicks(width) {
  return width < NARROW_CHART_WIDTH ? NARROW_TURN_TICKS : TURN_TICKS;
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

function percentTick(percent) {
  return `${percent}%`;
}

function tenthText(turnPercent) {
  return `${turnPercent - PERCENT_PER_TENTH}–${turnPercent}%`;
}
