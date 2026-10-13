/**
 * The Timeline view: a Gantt chart with one row per agent, the top-level session first, then each subagent in order
 * of its first request. Against time since the session's first request, a row shows its requests split into prefill
 * and decode, its tool calls in the tool part's green in a thinner band below, and its waits as pale bars: a wait for
 * a tool or the user in the colour of the part of the session's time it counts toward, and a wait for subagents, which
 * counts as tool time, in violet. A tool call's category is in its tooltip. A click on a bar opens its request in the
 * Requests view, and a range slider under the chart narrows the time it shows.
 */

import { legendLine } from "../session/legend.js";
import {
  barsWithin, ganttBars, ganttRows, placedInRow, requestPartEntries, toolCallEntry, undrawnCounts, waitEntries,
} from "./timeline_bars.js";
import { alignToChart, rangeSlider } from "./range_slider.js";
import { pointerFrame } from "./timeline_pointer.js";
import { startChartView, viewChartWidth } from "../session/view_chart.js";
import { elapsedAxis, isNarrowChart } from "../axes/ticks.js";
import { AXIS_STYLE, chartFrame, GRID_STYLE, legendPlace, nameChart, renderFigure } from "../shared/charts.js";
import { formatQuantity } from "../shared/format.js";

const ROW_HEIGHT = 32; // pixels per agent row
const MAX_HEIGHT = 808; // the tallest chart, in pixels: the tallest tree in the data (41 agents) keeps 18-px rows
const MARGINS = Object.freeze({ marginTop: 8, marginRight: 24, marginBottom: 48, marginLeft: 116 });
const NARROW_MARGIN_LEFT = 56; // pixels; room for "Sub 12", the row names of a narrow chart

/**
 * Draw the Timeline view of the session tree `tree`, its `requests` and `toolCalls` (rows of the session queries)
 * into `container`. Return a function that stops the view, to call before another replaces it.
 */
export function mountTimelineView(container, tree, requests, toolCalls) {
  return startChartView(container, (Plot) => drawTimelineView(Plot, container, tree, requests, toolCalls));
}

function drawTimelineView(Plot, container, tree, requests, toolCalls) {
  const figure = document.createElement("div");
  const body = renderFigure(figure, {
    title: "Where the time went",
    heading: "h2", // the view's title, under the page's h1
    caption: "Each agent's time in the parts' colours; subagent waits in violet.",
    definition:
      "One row per agent; on a phone the subagents are numbered in start order, and a bar's tooltip names its " +
      "agent. Each request is split into prefill (time to first token) and decode (the rest); each tool call runs " +
      "from its request's end for its latency, in the thin band below, since the data hold no tool call's start; " +
      "its tooltip names its category. A pale bar is a wait before a request, in the colour of the part of the " +
      "session's time it counts toward; a wait for subagents, which counts as tool time, is violet. Click a bar to " +
      "open its request.",
    rows: timelineRows(tree, requests, toolCalls),
  });
  container.replaceChildren(figure);
  const legend = document.createElement("div");
  legend.className = "legend-lines";
  legend.append(timelineLegend(requests));
  legendPlace(body).replaceChildren(legend);
  const bars = ganttBars(tree, requests, toolCalls).map(placedInRow);
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
  nameChart(body);
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
      Plot.rect(bars, { x1: "x1", x2: "x2", y1: "y1", y2: "y2", fill: "colour" }),
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

/** The legend, one line of the parts of the time: a request's parts, a tool call, and the waits this session has. */
function timelineLegend(requests) {
  return legendLine(null, [...requestPartEntries(requests), toolCallEntry(), ...waitEntries(requests)]);
}
