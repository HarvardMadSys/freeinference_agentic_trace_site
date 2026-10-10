/**
 * What the Context and Timeline views' charts share: time since the session's first request on the x axis, a width
 * that scrolls rather than shrinks on a narrow screen, drawing once Plot has loaded, and a click that opens a request.
 */

import { showError, showLoading } from "../shared/charts.js";

/** The event a view sends up from its chart when a click names a request; its `detail` is `{ sessionId, step }`. */
export const OPEN_REQUEST_EVENT = "open-request";

// The narrowest chart drawn, in pixels: a narrower view scrolls it sideways rather than shrinking its text.
const MIN_CHART_WIDTH = 480;

// The pixels an x axis gives each tick label, such as "+1:23:20".
const TICK_SPACING_PX = 90;

// The steps an elapsed-time axis ticks by, in seconds: round seconds, minutes, hours and days.
const TICK_STEPS_S = Object.freeze([
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 10800, 21600, 43200, 86400, 172800, 604800,
]);

const MILLISECONDS_PER_SECOND = 1000;

/** The seconds from `originMs` to `timeMs`, both in milliseconds. */
export function elapsedSeconds(timeMs, originMs) {
  return (timeMs - originMs) / MILLISECONDS_PER_SECOND;
}

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

/** The most ticks an axis `width` pixels wide holds without its labels touching, at least two. */
export function tickCount(width) {
  return Math.max(2, Math.floor(width / TICK_SPACING_PX));
}

/** The width to draw a chart in `body`: the body's width, but never under the narrowest chart drawn. */
export function viewChartWidth(body) {
  return Math.max(body.clientWidth, MIN_CHART_WIDTH);
}

/**
 * Show the loading state in `container`, then load Plot and call `draw(Plot)`, or show the error that stopped it.
 * Return a function that stops the view: a view stopped before Plot loads is never drawn, so it cannot cover the
 * view that replaced it.
 */
export function startChartView(container, draw) {
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
  if (!chart.value) {
    return;
  }
  const detail = { sessionId: chart.value.sessionId, step: chart.value.step };
  chart.dispatchEvent(new CustomEvent(OPEN_REQUEST_EVENT, { bubbles: true, detail }));
}
