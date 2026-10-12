/**
 * The Context view: the input of every request against time since the session's first request. The top-level
 * session's input is a stacked area, split into cached and uncached tokens or, by a switch, by role; each agent's
 * input is a line; dotted rules mark each turn's start and dots each mutation or switch. A click on a point opens
 * that request in the Requests view.
 */

import {
  AGENT_LINE_COLOURS, AREA_SPLITS, areaParts, areaRows, MARK_COLOURS, markEntries, pointTip, requestPoints,
  trajectoryPoints, transitionMarks, turnStarts,
} from "./context_series.js";
import { legendLine } from "../session/legend.js";
import { listenForRequestClick, startChartView, viewChartWidth } from "../session/view_chart.js";
import { elapsedAxis } from "../axes/ticks.js";
import {
  AXIS_STYLE, chartFrame, colourScale, GRID_STYLE, legendPlace, LINE_WIDTH, renderFigure, TIP_STYLE, X_INSET,
} from "../shared/charts.js";
import { formatQuantity, formatTokens } from "../shared/format.js";

// Subagents' lines are drawn a little lighter, so the top-level session's line reads above them where they cross.
const SUBAGENT_LINE_OPACITY = 0.8;

const TRANSITION_DOT_RADIUS = 3.5; // pixels: small markers
const TURN_DASH = "2 3"; // dash and gap of a turn's dotted rule, in pixels
const TURN_START_COLOUR = AXIS_STYLE.stroke; // a turn's dotted rule is drawn in the axis ink

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
    caption: "Input tokens of each request over the session.",
    definition:
      "Input tokens of each request at its start, against time since the session's first request: the top-level " +
      "session's input as a stacked area, and one line per agent; a request whose provider reported no cache reads " +
      "counts as uncached. Dotted rules mark each turn's start; dots mark a " +
      "request whose context was rewritten (mutation) or that went to another model or provider (switch). By " +
      "role, the parts are counted with one tokenizer, not the provider's, so they need not add up to the input. " +
      "Click a point to open its request.",
    rows: [
      formatQuantity(requests.length, "request", "requests"),
      formatQuantity(tree.length, "agent", "agents"),
    ].join(" · "),
  });
  container.replaceChildren(figure);
  const chartBox = document.createElement("div");
  const legend = document.createElement("div");
  legend.className = "legend-lines";
  const drawSplit = (split) => drawChart(Plot, { chartBox, legend, body }, tree, requests, split);
  legendPlace(body).replaceChildren(splitSwitch(drawSplit), legend);
  body.append(chartBox);
  drawSplit(DEFAULT_SPLIT);
}

/**
 * The two-part switch above the chart that chooses how the area splits the input, a pressed button per part;
 * choosing one redraws the chart.
 */
function splitSwitch(drawSplit) {
  const group = document.createElement("div");
  group.className = "segmented";
  group.setAttribute("role", "group");
  group.setAttribute("aria-label", "Split the input");
  for (const [split, text] of Object.entries(AREA_SPLITS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.setAttribute("aria-pressed", String(split === DEFAULT_SPLIT));
    button.addEventListener("click", () => chooseSplit(group, button, drawSplit, split));
    group.append(button);
  }
  return group;
}

function chooseSplit(group, chosenButton, drawSplit, split) {
  for (const button of group.querySelectorAll("button")) {
    button.setAttribute("aria-pressed", String(button === chosenButton));
  }
  drawSplit(split);
}

/** Draw the chart for `split` into `boxes.chartBox` and its legend into `boxes.legend`. */
function drawChart(Plot, boxes, tree, requests, split) {
  const parts = areaParts(split);
  const points = requestPoints(tree, requests);
  const trajectories = trajectoryPoints(tree, requests);
  const marks = transitionMarks(points);
  const width = viewChartWidth(boxes.body);
  const maxElapsed = Math.max(...trajectories.map((point) => point.elapsed));
  const axis = elapsedAxis(maxElapsed, width);
  const chart = Plot.plot({
    ...chartFrame(boxes.body),
    width,
    x: { domain: [0, maxElapsed], inset: X_INSET },
    y: { nice: true },
    color: colourScale(new Map(parts.map((part) => [part.name, part.colour])), parts.map((part) => part.name)),
    marks: [
      Plot.gridY(GRID_STYLE),
      Plot.areaY(areaRows(tree, requests, split), {
        x: "elapsed", y: "tokens", fill: "part", z: "part", order: parts.map((part) => part.name), curve: "step-after",
      }),
      Plot.ruleX(turnStarts(tree, requests), { ...AXIS_STYLE, strokeDasharray: TURN_DASH }),
      agentLines(Plot, trajectories),
      transitionDots(Plot, marks),
      Plot.axisX({ ...AXIS_STYLE, ...axis }),
      Plot.axisY({ ...AXIS_STYLE, tickFormat: formatTokens, label: "Input tokens" }),
      Plot.tip(points, Plot.pointer({ ...TIP_STYLE, x: "elapsed", y: "inputTokens", title: pointTip })),
    ],
  });
  listenForRequestClick(boxes.body, chart);
  boxes.chartBox.replaceChildren(chart);
  boxes.legend.replaceChildren(...contextLegend(parts, tree, marks));
}

/** One line per agent, stepping at each request: the top-level session's first, then the subagents', lighter. */
function agentLines(Plot, trajectories) {
  const lineOptions = { x: "elapsed", y: "inputTokens", z: "sessionId", curve: "step-after", strokeWidth: LINE_WIDTH };
  return [
    Plot.line(trajectories.filter((point) => !point.isTopLevel), {
      ...lineOptions, stroke: AGENT_LINE_COLOURS.subagents, strokeOpacity: SUBAGENT_LINE_OPACITY,
    }),
    Plot.line(trajectories.filter((point) => point.isTopLevel), { ...lineOptions, stroke: AGENT_LINE_COLOURS.main }),
  ];
}

/** One dot mark per marked transition, each in its colour. */
function transitionDots(Plot, marks) {
  const dots = [];
  for (const [transition, colour] of Object.entries(MARK_COLOURS)) {
    const marked = marks.filter((point) => point.transition === transition);
    dots.push(Plot.dot(marked, { x: "elapsed", y: "inputTokens", r: TRANSITION_DOT_RADIUS, fill: colour }));
  }
  return dots;
}

// The legend's lines: the parts of the top-level input, each agent's line, and the markers on them.
function contextLegend(parts, tree, marks) {
  const agents = [{ name: "main", colour: AGENT_LINE_COLOURS.main, shape: "line" }];
  if (tree.length > 1) {
    const colour = AGENT_LINE_COLOURS.subagents;
    agents.push({ name: "subagents", colour, opacity: SUBAGENT_LINE_OPACITY, shape: "line" });
  }
  const dots = markEntries(marks).map((entry) => ({ ...entry, shape: "dot" }));
  const markers = [...dots, { name: "turn start", colour: TURN_START_COLOUR, shape: "dotted" }];
  return [legendLine("Top-level input", parts), legendLine("Agents", agents), legendLine("Markers", markers)];
}
