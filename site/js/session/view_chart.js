/**
 * What the Context and Timeline views' charts share: time since the session's first request on the x axis, its ticks
 * and their format, drawing at the card's width once Plot has loaded, and a click that opens a request.
 */

import { showError, showLoading } from "../shared/charts.js";
import { MAX_TICKS } from "../axes/ticks.js";
import { elapsedTickFormat } from "../shared/format.js";

/** The event a view sends up from its chart when a click names a request; its `detail` is `{ sessionId, step }`. */
export const OPEN_REQUEST_EVENT = "open-request";

// The pixels an x axis gives each tick label, such as "12:30".
const TICK_SPACING_PX = 90;

// The steps an elapsed-time axis ticks by, in seconds: round seconds, minutes, hours and days.
const TICK_STEPS_S = Object.freeze([
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800,
]);

/**
 * The ticks of an elapsed-time axis from 0 to `maxSeconds`: every multiple of the smallest round step that gives at
 * most `maxTicks` intervals, or of a whole number of seconds when even a week is too fine.
 */
export function elapsedTicks(maxSeconds, maxTicks) {
  const step = TICK_STEPS_S.find((seconds) => maxSeconds / seconds <= maxTicks) ?? Math.ceil(maxSeconds / maxTicks);
  const ticks = [];
  for (let tick = 0; tick <= maxSeconds; tick += step) {
    ticks.push(tick);
  }
  return ticks;
}

/** The most ticks an axis `width` pixels wide holds without its labels touching: at least two, at most `MAX_TICKS`. */
export function tickCount(width) {
  return Math.min(MAX_TICKS, Math.max(2, Math.floor(width / TICK_SPACING_PX)));
}

/**
 * The elapsed-time x axis of a chart `width` pixels wide reaching `maxSeconds`: `{ ticks, tickFormat, label }`, its
 * ticks in h:mm from an hour on, else m:ss, its title naming which.
 */
export function elapsedAxis(maxSeconds, width) {
  const { format, unit } = elapsedTickFormat(maxSeconds);
  return { ticks: elapsedTicks(maxSeconds, tickCount(width)), tickFormat: format, label: `Time since first request (${unit})` };
}

/** The width to draw a chart in `body`: the card's, so the chart never runs past it on a phone. */
export function viewChartWidth(body) {
  return body.clientWidth;
}

/**
 * Show the loading state in `container`, then load Plot and call `draw(Plot)`, or show the error that stopped it.
 * Return a function that stops the view: a view stopped before Plot loads is never drawn, so it cannot cover the
 * view that replaced it.
 */
export function startChartView(container, draw) {
  // An AbortController rather than the run counter the Explore and Figures pages keep: stopping a view must also
  // drop a Plot load still in flight, and the caller holds only the stop function this returns.
  const controller = new AbortController();
  showLoading(container);
  drawWithPlot(container, draw, controller.signal);
  return () => controller.abort();
}

/** A box holding `chart` that scrolls it sideways when it is wider than the screen. */
export function scrollBox(chart) {
  const box = document.createElement("div");
  box.className = "chart-scroll";
  box.append(chart);
  return box;
}

/**
 * Make a click on `chart` open the request under the pointer: the datum Plot's pointer holds as the chart's `value`
 * (one with `sessionId` and `step`), sent up as `OPEN_REQUEST_EVENT`.
 */
export function listenForRequestClick(body, chart) {
  body.classList.add("is-clickable");
  chart.addEventListener("click", () => openPointedRequest(chart));
}

/** Send `OPEN_REQUEST_EVENT` up from `element` for the request of `datum`, a value with `sessionId` and `step`. */
export function sendOpenRequest(element, datum) {
  const detail = { sessionId: datum.sessionId, step: datum.step };
  element.dispatchEvent(new CustomEvent(OPEN_REQUEST_EVENT, { bubbles: true, detail }));
}

async function drawWithPlot(container, draw, signal) {
  try {
    // Plot is loaded here, not at the top of a view's module, so node can test the views' pure functions.
    const { Plot } = await import("../shared/libraries.js");
    if (!signal.aborted) {
      draw(Plot);
    }
  } catch (error) {
    if (!signal.aborted) {
      showError(container, error);
    }
  }
}

function openPointedRequest(chart) {
  // Plot keeps the datum under the pointer, the one its tooltip shows, as the chart's `value`; null when there is none.
  if (chart.value) {
    sendOpenRequest(chart, chart.value);
  }
}
