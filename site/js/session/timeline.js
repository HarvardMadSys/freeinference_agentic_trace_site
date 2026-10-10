/**
 * The Timeline view: a Gantt chart with one row per agent, the top-level session first, then each subagent in order
 * of its first request. Against time since the session's first request, a row shows its requests split at time to
 * first token, its tool calls in a thinner band below, and its waits as lighter bars coloured by what they waited
 * for. A click on a bar opens its request in the Requests view.
 */

import { categoryEntries, legendLine } from "./legend.js";
import {
  ganttBars, ganttRows, REQUEST_PART_COLOURS, undrawnCounts, WAIT_CAUSES, WAIT_OPACITY, waitColours,
} from "./timeline_bars.js";
import {
  elapsedTicks, listenForRequestClick, scrollBox, startChartView, tickCount, viewChartWidth,
} from "./view_chart.js";
import { AXIS_STYLE, chartFrame, GRID_STYLE, renderFigure, TIP_STYLE } from "../shared/charts.js";
import { formatElapsed, formatQuantity } from "../shared/format.js";

const ROW_HEIGHT = 24; // pixels per agent row
const MAX_HEIGHT = 600; // the tallest chart, in pixels; a tree of more agents gets thinner rows
const MARGINS = Object.freeze({ marginTop: 16, marginRight: 24, marginBottom: 40, marginLeft: 92 });

// Where each band sits in its row, as shares of the row from its top: requests and waits, and below them tool calls.
const BAND_SPANS = Object.freeze({ request: [0.12, 0.6], tool: [0.66, 0.88] });

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
      "coloured by what it waited for. Click a bar to open its request.",
    caption: timelineCaption(tree, requests, toolCalls),
  });
  container.replaceChildren(figure);
  const rows = ganttRows(tree);
  const bars = ganttBars(tree, requests, toolCalls, categoryColours).map((bar) => placedInRow(bar));
  const chart = ganttChart(Plot, body, rows, bars);
  listenForRequestClick(body, chart);
  body.append(scrollBox(chart), ...timelineLegend(requests, toolCalls, categoryColours));
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
      Plot.rect(bars, {
        x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "colour", fillOpacity: "opacity", title: "tip", tip: TIP_STYLE,
      }),
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

/** `bar` with `y1` and `y2`, the top and bottom of its band in its agent's row. */
function placedInRow(bar) {
  const [top, bottom] = BAND_SPANS[bar.band];
  return { ...bar, y1: bar.row + top, y2: bar.row + bottom };
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
  const parts = [
    { name: "time to first token", colour: REQUEST_PART_COLOURS.ttft },
    { name: "rest of the request", colour: REQUEST_PART_COLOURS.decode },
  ];
  if (requests.some((request) => request.ttft_ms === null)) {
    parts.push({ name: "no time to first token", colour: REQUEST_PART_COLOURS.whole });
  }
  const colours = waitColours();
  const waits = [];
  for (const [cause, name] of Object.entries(WAIT_CAUSES)) {
    if (requests.some((request) => request.waited_for === cause)) {
      waits.push({ name, colour: colours.get(cause), opacity: WAIT_OPACITY });
    }
  }
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
