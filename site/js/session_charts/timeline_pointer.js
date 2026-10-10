/**
 * The Timeline's pointer: the bar under it, found by the bar's span of time rather than its middle, so the whole of a
 * long wait points at the wait; a tooltip for that bar; and a click that opens its request.
 */

import { barAt, pointerPlace } from "./timeline_bars.js";
import { scrollBox, sendOpenRequest } from "../session/view_chart.js";

// How near, in pixels, the pointer must come to a bar that holds no point under it, such as one under a pixel wide.
const POINTER_REACH_PX = 3;

// The gap between the pointer and its tooltip, in pixels.
const TIP_OFFSET_PX = 12;

/**
 * A frame holding the Gantt `chart` in a scroll box, with a tooltip for the bar under the pointer and a click on
 * that bar opening its request. `bars` are the chart's bars, placed in rows; `rowCount` is the number of rows.
 */
export function pointerFrame(chart, bars, rowCount) {
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
