/**
 * The Timeline view: a Gantt chart with one row per agent, the top-level session first, then each subagent in order
 * of its first request. Against time since the session's first request, a row shows its requests split into prefill
 * and decode, its tool calls in the tool part's green in a thinner band below, and its waits as pale bars: a wait for
 * a tool or the user in the colour of the part of the session's time it counts toward, and a wait for subagents, which
 * counts as tool time, in violet. A tool call's category is in its tooltip. A click on a bar opens its request in the
 * Requests view, and a range slider under the chart narrows the time it shows.
 *
 * The pointer finds the bar under it by the bar's span of time rather than its middle, so the whole of a long wait
 * points at the wait, and shows that bar's tooltip beside it.
 */

import { legendLine } from "../session/legend.js";
import {
  barAt, barsWithin, ganttBars, ganttRows, placedInRow, pointerPlace, requestPartEntries, toolCallEntry, undrawnCounts,
  waitEntries,
} from "./timeline_bars.js";
import { alignToChart, rangeSlider } from "./range_slider.js";
import { sendOpenRequest, startChartView } from "../session/view_chart.js";
import { elapsedAxis, isNarrowChart } from "../axes/ticks.js";
import { AXIS_STYLE, chartFrame, GRID_STYLE, legendPlace, nameChart, renderFigure } from "../shared/charts.js";
import { formatQuantity } from "../shared/format.js";

const ROW_HEIGHT = 32; // pixels per agent row
const MAX_HEIGHT = 808; // the tallest chart, in pixels: the tallest tree in the data (41 agents) keeps 18-px rows
const MARGINS = Object.freeze({ marginTop: 8, marginRight: 24, marginBottom: 48, marginLeft: 116 });
const NARROW_MARGIN_LEFT = 56; // pixels; room for "Sub 12", the row names of a narrow chart
const POINTER_REACH_PX = 3; // how near the pointer must come to a bar with no point under it, such as one under a pixel
const TIP_OFFSET_PX = 12; // the gap between the pointer and its tooltip, in pixels

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
  const frame = chartFrame(body);
  const height = Math.min(MAX_HEIGHT, MARGINS.marginTop + MARGINS.marginBottom + ROW_HEIGHT * rows.length);
  const axis = elapsedAxis([range.start, range.end], frame.width);
  const isNarrow = isNarrowChart(frame.width);
  const labels = rows.map((row) => (isNarrow ? row.shortLabel : row.label));
  return Plot.plot({
    ...frame,
    ...MARGINS,
    marginLeft: isNarrow ? NARROW_MARGIN_LEFT : MARGINS.marginLeft,
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

/**
 * A frame holding the Gantt `chart` in a scroll box, with a tooltip for the bar under the pointer and a click on
 * that bar opening its request. `bars` are the chart's bars, placed in rows; `rowCount` is the number of rows.
 */
function pointerFrame(chart, bars, rowCount) {
  const frame = document.createElement("div");
  frame.className = "chart-frame";
  const tip = document.createElement("div");
  tip.className = "chart-tip";
  tip.hidden = true;
  frame.append(scrollBox(chart), tip);
  const barUnder = (event) => pointedBar(chart, event, bars, rowCount);
  chart.addEventListener("pointermove", (event) => showTip(frame, tip, barUnder(event), event));
  chart.addEventListener("pointerleave", () => showTip(frame, tip, null, null));
  chart.addEventListener("click", (event) => openBar(chart, barUnder(event)));
  return frame;
}

/** The bar under the pointer of `event`, or null: Plot's scales turn the pointer's position into seconds and rows. */
function pointedBar(chart, event, bars, rowCount) {
  const xScale = chart.scale("x");
  const yScale = chart.scale("y");
  const bounds = chart.getBoundingClientRect();
  const pixelX = event.clientX - bounds.left;
  const y = yScale.invert(event.clientY - bounds.top);
  const [left, right] = xScale.range;
  if (pixelX < left || pixelX > right || y < 0 || y >= rowCount) {
    return null;
  }
  const secondsPerPixel = Math.abs(xScale.invert(1) - xScale.invert(0));
  const toleranceSeconds = POINTER_REACH_PX * secondsPerPixel;
  return barAt(bars, { x: xScale.invert(pixelX), ...pointerPlace(y), toleranceSeconds });
}

/** Show `bar`'s tooltip beside the pointer, kept inside the frame's width; hide it when there is no bar. */
function showTip(frame, tip, bar, event) {
  frame.classList.toggle("is-pointing", bar !== null);
  if (bar === null) {
    tip.hidden = true;
    return;
  }
  tip.textContent = bar.tip;
  tip.hidden = false;
  const bounds = frame.getBoundingClientRect();
  const pointerX = event.clientX - bounds.left;
  const fitsRight = pointerX + TIP_OFFSET_PX + tip.offsetWidth <= frame.clientWidth;
  const left = fitsRight ? pointerX + TIP_OFFSET_PX : Math.max(0, pointerX - TIP_OFFSET_PX - tip.offsetWidth);
  tip.style.left = `${left}px`;
  tip.style.top = `${event.clientY - bounds.top + TIP_OFFSET_PX}px`;
}

function openBar(chart, bar) {
  if (bar !== null) {
    sendOpenRequest(chart, bar);
  }
}

/**
 * A box holding `chart` that would scroll it sideways were it wider than its card; the chart is drawn at the card's
 * width, but its row labels keep their size, and the box is what its tooltip is placed against.
 */
function scrollBox(chart) {
  const box = document.createElement("div");
  box.className = "chart-scroll";
  box.append(chart);
  return box;
}
