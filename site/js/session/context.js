/**
 * The Context view: the input of every request against time since the session's first request. The top-level
 * session's input is a stacked area, split into cached and uncached tokens or, by a switch, by role; each agent's
 * input is a line; dotted rules mark each turn's start and dots each mutation or switch. A click on a point opens
 * that request in the Requests view.
 */

import {
  AREA_SPLITS, areaParts, areaRows, pointTip, requestPoints, trajectoryPoints, transitionMarks, turnStarts,
} from "./context_series.js";
import { legendLine } from "./legend.js";
import {
  elapsedTicks, listenForRequestClick, scrollBox, startChartView, tickCount, viewChartWidth,
} from "./view_chart.js";
import {
  assignColours, AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, LINE_WIDTH, SERIES_SLOTS, TIP_STYLE, renderFigure,
} from "../shared/charts.js";
import { formatElapsed, formatQuantity, formatTokens } from "../shared/format.js";

// The colour of each agent's line: the top-level session's, then every subagent's.
const AGENT_KINDS = Object.freeze(["main", "subagents"]);

// Subagents' lines are drawn a little lighter, so the top-level session's line reads above them where they cross.
const SUBAGENT_LINE_OPACITY = 0.8;

// The colour of the dot on a request whose context was rewritten or switched: the last series slot.
const TRANSITION_COLOUR = SERIES_SLOTS[7];

const TRANSITION_DOT_RADIUS = 3.5; // pixels: small markers
const TURN_DASH = "2 3"; // dash and gap of a turn's dotted rule, in pixels

// The split the area shows when the view opens.
const DEFAULT_SPLIT = "tokens";

/**
 * Draw the Context view of the session tree `tree` (rows of `session/session_tree`) and its `requests` into
 * `container`. Return a function that stops the view, to call before another replaces it.
 */
export function mountContextView(container, tree, requests) {
  return startChartView(container, (Plot) => drawContextView(Plot, container, tree, requests));
}

function drawContextView(Plot, container, tree, requests) {
  const figure = document.createElement("div");
  const body = renderFigure(figure, {
    title: "Context over time",
    definition:
      "Input tokens of each request at its start, against time since the session's first request: the top-level " +
      "session's input as a stacked area, and one line per agent. Dotted rules mark each turn's start; dots mark a " +
      "request whose context was rewritten (mutation) or that went to another model or provider (switch). By " +
      "role, the parts are counted with one tokenizer, not the provider's, so they need not add up to the input. " +
      "Click a point to open its request.",
    caption: [
      formatQuantity(requests.length, "request", "requests"),
      formatQuantity(tree.length, "agent", "agents"),
    ].join(" · "),
  });
  const chartBox = document.createElement("div");
  const legend = document.createElement("div");
  const drawSplit = (split) => drawChart(Plot, { chartBox, legend, body }, tree, requests, split);
  body.append(splitSwitch(drawSplit), chartBox, legend);
  container.replaceChildren(figure);
  drawSplit(DEFAULT_SPLIT);
}

/** The two pills above the chart that choose how the area splits the input; choosing one redraws the chart. */
function splitSwitch(drawSplit) {
  const group = document.createElement("div");
  group.className = "control-group";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Split the input");
  for (const [split, text] of Object.entries(AREA_SPLITS)) {
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "context-split";
    input.checked = split === DEFAULT_SPLIT;
    const pill = document.createElement("label");
    pill.className = input.checked ? "pill is-selected" : "pill";
    pill.append(input, text);
    input.addEventListener("change", () => chooseSplit(group, pill, drawSplit, split));
    group.append(pill);
  }
  return group;
}

function chooseSplit(group, chosenPill, drawSplit, split) {
  for (const pill of group.querySelectorAll(".pill")) {
    pill.classList.toggle("is-selected", pill === chosenPill);
  }
  drawSplit(split);
}

/** Draw the chart for `split` into `boxes.chartBox` and its legend into `boxes.legend`. */
function drawChart(Plot, boxes, tree, requests, split) {
  const parts = areaParts(tree, requests, split);
  const agentColours = assignColours(AGENT_KINDS);
  const points = requestPoints(tree, requests);
  const trajectories = trajectoryPoints(tree, requests);
  const marks = transitionMarks(points);
  const width = viewChartWidth(boxes.body);
  const maxElapsed = Math.max(...trajectories.map((point) => point.elapsed));
  const chart = Plot.plot({
    ...chartFrame(boxes.body),
    width,
    x: { domain: [0, maxElapsed] },
    y: { nice: true },
    color: colourScale(new Map(parts.map((part) => [part.name, part.colour])), parts.map((part) => part.name), false),
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.areaY(areaRows(tree, requests, split), {
        x: "elapsed", y: "tokens", fill: "part", z: "part", order: parts.map((part) => part.name), curve: "step-after",
      }),
      Plot.ruleX(turnStarts(tree, requests), { ...AXIS_STYLE, strokeDasharray: TURN_DASH }),
      agentLines(Plot, trajectories, agentColours),
      Plot.dot(marks, { x: "elapsed", y: "inputTokens", r: TRANSITION_DOT_RADIUS, fill: TRANSITION_COLOUR }),
      Plot.axisX({ ...AXIS_STYLE, ticks: elapsedTicks(maxElapsed, tickCount(width)), tickFormat: formatElapsed,
        label: "Time since the session's first request" }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatTokens, label: "Input tokens" }),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "elapsed", y: "inputTokens", title: pointTip })),
    ],
  });
  listenForRequestClick(boxes.body, chart);
  boxes.chartBox.replaceChildren(scrollBox(chart));
  boxes.legend.replaceChildren(...contextLegend(parts, tree, agentColours, marks.length > 0));
}

/** One line per agent, stepping at each request: the top-level session's first, then the subagents', lighter. */
function agentLines(Plot, trajectories, agentColours) {
  const lineOptions = { x: "elapsed", y: "inputTokens", z: "sessionId", curve: "step-after", strokeWidth: LINE_WIDTH };
  return [
    Plot.line(trajectories.filter((point) => !point.isTopLevel), {
      ...lineOptions, stroke: agentColours.get("subagents"), strokeOpacity: SUBAGENT_LINE_OPACITY,
    }),
    Plot.line(trajectories.filter((point) => point.isTopLevel), { ...lineOptions, stroke: agentColours.get("main") }),
  ];
}

function contextLegend(parts, tree, agentColours, hasMarks) {
  const lines = [{ name: "main", colour: agentColours.get("main") }];
  if (tree.length > 1) {
    lines.push({ name: "subagents", colour: agentColours.get("subagents"), opacity: SUBAGENT_LINE_OPACITY });
  }
  if (hasMarks) {
    lines.push({ name: "mutation or switch", colour: TRANSITION_COLOUR });
  }
  return [legendLine("Top-level input", parts), legendLine("Input per agent", lines)];
}
