/**
 * The Timeline view: a Gantt chart with one row per agent, the top-level session first, then each subagent in order
 * of its first request. Against time since the session's first request, a row shows its requests split at time to
 * first token, its tool calls in a thinner band below, and its waits as lighter bars coloured by what they waited
 * for. A click on a bar opens its request in the Requests view.
 */

import { categoryEntries, legendLine } from "../session/legend.js";
import {
  ganttBars, ganttRows, placedInRow, requestPartEntries, undrawnCounts, waitEntries,
} from "./timeline_bars.js";
import { pointerFrame } from "./timeline_pointer.js";
import { elapsedTicks, startChartView, tickCount, viewChartWidth } from "../session/view_chart.js";
import { AXIS_STYLE, chartFrame, GRID_STYLE, renderFigure } from "../shared/charts.js";
import { formatElapsed, formatQuantity } from "../shared/format.js";

const ROW_HEIGHT = 24; // pixels per agent row
const MAX_HEIGHT = 808; // the tallest chart, in pixels: the tallest tree in the data (41 agents) keeps 18-px rows
const MARGINS = Object.freeze({ marginTop: 16, marginRight: 24, marginBottom: 48, marginLeft: 116 });

// The sentence the caption must hold: the data has no tool call start times.
const TOOL_START_NOTE = "A tool call's start is taken as its request's end.";

/**
 * Draw the Timeline view of the session tree `tree`, its `requests` and `toolCalls` (rows of the session queries)
 * into `container`. `options` is `{ categoryColours }`, the site-wide map from each tool category to its colour.
 * Return a function that stops the view, to call before another replaces it.
 */
export function mountTimelineView(container, tree, requests, toolCalls, options) {
  return startChartView(container, (Plot) => drawTimelineView(Plot, container, tree, requests, toolCalls, options));
}

function drawTimelineView(Plot, container, tree, requests, toolCalls, { categoryColours }) {
  const figure = document.createElement("div");
  const body = renderFigure(figure, {
    title: "Where the time went",
    definition:
      "One row per agent. Each request is split into time to first token and the rest; each tool call runs from " +
      "its request's end for its latency, in the thin band below; a lighter bar is a wait before a request, " +
      "coloured by what it waited for. Requests are drawn in ink tones, so a colour is a tool category or a wait. " +
      "Click a bar to open its request.",
    caption: timelineCaption(tree, requests, toolCalls),
  });
  container.replaceChildren(figure);
  const rows = ganttRows(tree);
  const bars = ganttBars(tree, requests, toolCalls, categoryColours).map(placedInRow);
  const chart = ganttChart(Plot, body, rows, bars);
  body.append(pointerFrame(chart, bars, rows.length), ...timelineLegend(requests, toolCalls, categoryColours));
}

/** The Gantt chart of `bars` over `rows`: row 0 at the top, each bar in its band of its row. */
function ganttChart(Plot, body, rows, bars) {
  const width = viewChartWidth(body);
  const height = Math.min(MAX_HEIGHT, MARGINS.marginTop + MARGINS.marginBottom + ROW_HEIGHT * rows.length);
  const maxElapsed = Math.max(...bars.map((bar) => bar.x2));
  return Plot.plot({
    ...chartFrame(body),
    ...MARGINS,
    width,
    height,
    x: { domain: [0, maxElapsed] },
    y: { domain: [0, rows.length], reverse: true },
    color: { type: "identity" },
    opacity: { type: "identity" },
    marks: [
      Plot.gridX(GRID_STYLE),
      // The tooltip and the click come from `pointerFrame`, which finds a bar by its span rather than its middle.
      Plot.rect(bars, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "colour", fillOpacity: "opacity" }),
      Plot.axisX({
        ...AXIS_STYLE, ticks: elapsedTicks(maxElapsed, tickCount(width)), tickFormat: formatElapsed,
        label: "Time since the session's first request",
      }),
      Plot.axisY({
        ...AXIS_STYLE, ticks: rows.map((row, index) => index + 0.5), tickFormat: (tick) => rows[Math.floor(tick)].label,
        tickSize: 0, label: null,
      }),
    ],
  });
}

function timelineCaption(tree, requests, toolCalls) {
  const counts = [
    formatQuantity(requests.length, "request", "requests"),
    formatQuantity(toolCalls.length, "tool call", "tool calls"),
    formatQuantity(tree.length, "agent", "agents"),
  ];
  const undrawn = undrawnCounts(requests, toolCalls);
  const notes = [];
  if (undrawn.toolCalls > 0) {
    notes.push(`${formatQuantity(undrawn.toolCalls, "tool call", "tool calls")} without a latency not drawn.`);
  }
  if (undrawn.waits > 0) {
    const overlapping = formatQuantity(undrawn.waits, "request", "requests");
    notes.push(`${overlapping} that started before the previous one ended show no wait.`);
  }
  return [TOOL_START_NOTE, `${counts.join(" · ")}.`, ...notes].join(" ");
}

/** The legend's lines: a request's parts, the waits this session has, and the categories of its tool calls. */
function timelineLegend(requests, toolCalls, categoryColours) {
  const parts = requestPartEntries(requests);
  const waits = waitEntries(requests);
  const lines = [legendLine("Requests", parts)];
  if (waits.length > 0) {
    lines.push(legendLine("Waits for", waits));
  }
  const categories = categoryEntries(toolCalls, categoryColours);
  if (categories.length > 0) {
    lines.push(legendLine("Tool calls", categories));
  }
  return lines;
}
