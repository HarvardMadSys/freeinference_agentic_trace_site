/**
 * The Timeline view: a Gantt chart with one row per agent, the top-level session first, then each subagent in order
 * of its first request. Against time since the session's first request, a row shows its requests split into prefill
 * and decode, its tool calls in a thinner band below, and its waits as pale bars in the colour of the part of the
 * session's time they count toward. A click on a bar opens its request in the Requests view, and a range slider under the chart narrows the time
 * it shows.
 */

import { categoryEntries, legendLine } from "../session/legend.js";
import {
  barsWithin, ganttBars, ganttRows, placedInRow, requestPartEntries, undrawnCounts, waitEntries,
} from "./timeline_bars.js";
import { alignToChart, rangeSlider } from "./range_slider.js";
import { pointerFrame } from "./timeline_pointer.js";
import { startChartView, viewChartWidth } from "../session/view_chart.js";
import { elapsedAxis, isNarrowChart } from "../axes/ticks.js";
import { AXIS_STYLE, chartFrame, GRID_STYLE, legendPlace, renderFigure } from "../shared/charts.js";
import { formatQuantity } from "../shared/format.js";

const ROW_HEIGHT = 32; // pixels per agent row
const MAX_HEIGHT = 808; // the tallest chart, in pixels: the tallest tree in the data (41 agents) keeps 18-px rows
const MARGINS = Object.freeze({ marginTop: 8, marginRight: 24, marginBottom: 48, marginLeft: 116 });
const NARROW_MARGIN_LEFT = 56; // pixels; room for "Sub 12", the row names of a narrow chart

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
    caption: "Each agent's requests, tool calls and waits, along the session.",
    definition:
      "One row per agent; on a phone the subagents are numbered in start order, and a bar's tooltip names its " +
      "agent. Each request is split into prefill (time to first token) and decode (the rest); each tool call runs " +
      "from its request's end for its latency, in the thin band below, in its tool group's colour, since the data " +
      "hold no tool call's start; a pale bar is a wait before a request, in the colour of the part of the " +
      "session's time it counts toward. Click a bar to open its request.",
    rows: timelineRows(tree, requests, toolCalls),
  });
  container.replaceChildren(figure);
  const legend = document.createElement("div");
  legend.className = "legend-lines";
  legend.append(...timelineLegend(requests, toolCalls, categoryColours));
  legendPlace(body).replaceChildren(legend);
  const bars = ganttBars(tree, requests, toolCalls, categoryColours).map(placedInRow);
  const totalSeconds = Math.max(...bars.map((bar) => bar.x2));
  const gantt = { Plot, body, rows: ganttRows(tree), bars, chartPlace: document.createElement("div") };
  gantt.slider = rangeSlider(totalSeconds, (range) => drawGantt(gantt, range));
  body.append(gantt.chartPlace, gantt.slider);
  drawGantt(gantt, { start: 0, end: totalSeconds });
}

/**
 * Draw the Gantt over the time `range` into `gantt.chartPlace`, its bars cut at the range's edges, with its pointer,
 * and line the slider up with it.
 */
function drawGantt({ Plot, body, rows, bars, chartPlace, slider }, range) {
  const shownBars = barsWithin(bars, range);
  const chart = ganttChart(Plot, body, rows, shownBars, range);
  chartPlace.replaceChildren(pointerFrame(chart, shownBars, rows.length));
  alignToChart(slider, chart);
}

/** The Gantt chart of `bars` over `rows` and the time `range`: row 0 at the top, each bar in its band of its row. */
function ganttChart(Plot, body, rows, bars, range) {
  const width = viewChartWidth(body);
  const height = Math.min(MAX_HEIGHT, MARGINS.marginTop + MARGINS.marginBottom + ROW_HEIGHT * rows.length);
  const axis = elapsedAxis([range.start, range.end], width);
  const isNarrow = isNarrowChart(width);
  const labels = rows.map((row) => (isNarrow ? row.shortLabel : row.label));
  return Plot.plot({
    ...chartFrame(body),
    ...MARGINS,
    marginLeft: isNarrow ? NARROW_MARGIN_LEFT : MARGINS.marginLeft,
    width,
    height,
    x: { domain: [range.start, range.end] },
    y: { domain: [0, rows.length], reverse: true },
    color: { type: "identity" },
    marks: [
      Plot.gridX(GRID_STYLE),
      // The tooltip and the click come from `pointerFrame`, which finds a bar by its span rather than its middle.
      Plot.rect(bars.filter((bar) => !bar.isWait), { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "colour" }),
      // A wait is a pale tint of its colour, its opacity set per scheme by the class (`--wait-opacity`).
      Plot.rect(bars.filter((bar) => bar.isWait), {
        x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "colour", className: "timeline-wait",
      }),
      Plot.axisX({ ...AXIS_STYLE, ...axis }),
      Plot.axisY({
        ...AXIS_STYLE, ticks: rows.map((row, index) => index + 0.5), tickFormat: (tick) => labels[Math.floor(tick)],
        tickSize: 0, label: null,
      }),
    ],
  });
}

// The line of rows behind the Definition control: the requests, tool calls and agents drawn, and what is not drawn.
function timelineRows(tree, requests, toolCalls) {
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
  return [`${counts.join(" · ")}.`, ...notes].join(" ");
}

/** The legend's lines: a request's parts, the waits this session has, and the categories of its tool calls. */
function timelineLegend(requests, toolCalls, categoryColours) {
  const parts = requestPartEntries(requests);
  const waits = waitEntries(requests);
  const lines = [legendLine("Requests", parts)];
  if (waits.length > 0) {
    lines.push(legendLine("Waits", waits));
  }
  const categories = categoryEntries(toolCalls, categoryColours);
  if (categories.length > 0) {
    lines.push(legendLine("Tool calls", categories));
  }
  return lines;
}
