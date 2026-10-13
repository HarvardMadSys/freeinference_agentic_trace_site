/**
 * What the Context and Timeline views' charts share: drawing at the card's width once Plot has loaded, and a click
 * that opens a request. Their time axis, time since the session's first request, is `elapsedAxis` of `axes/ticks.js`.
 */

import { showError, showLoading } from "../shared/charts.js";

/** The event a view sends up from its chart when a click names a request; its `detail` is `{ sessionId, step }`. */
export const OPEN_REQUEST_EVENT = "open-request";

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
  // An AbortController rather than a run counter: stopping a view must also drop a Plot load still in flight, and the
  // caller holds only the stop function this returns.
  const controller = new AbortController();
  showLoading(container);
  drawWithPlot(container, draw, controller.signal);
  return () => controller.abort();
}

/**
 * A box holding `chart` that would scroll it sideways were it wider than its card; a chart is drawn at the card's width,
 * but the Timeline's row labels keep their size, and the box is what its tooltip is placed against.
 */
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
