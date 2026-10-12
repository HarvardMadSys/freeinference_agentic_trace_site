/**
 * The range slider under the Context and Timeline charts: a thin bar spanning the session's elapsed time, the chosen
 * range marked on it between two handles, which a pointer drags and the arrow keys move. A range is `{ start, end }`
 * in seconds since the session's first request. The arithmetic is plain functions, tested with `node --test`;
 * `rangeSlider` draws the strip and calls back with each range chosen.
 */

import { formatElapsed } from "../shared/format.js";

/** The narrowest range, as a share of the session: narrower, the two handles would sit on one another. */
export const MIN_RANGE_SHARE = 0.01;
/** How far an arrow key moves a focused handle, as a share of the session. */
export const KEY_STEP_SHARE = 0.01;

// Each handle, the end of the range it moves, and what a screen reader calls it.
const HANDLE_NAMES = Object.freeze({ start: "Start of the time range", end: "End of the time range" });

// The keys that move a focused handle, each with the direction it moves it: earlier or later.
const KEY_DIRECTIONS = Object.freeze({ ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 });

/** The narrowest range, in seconds, a session `totalSeconds` long allows. */
export function minimumRange(totalSeconds) {
  return totalSeconds * MIN_RANGE_SHARE;
}

/** The seconds at `offset` pixels along a bar `width` pixels wide spanning `totalSeconds`, kept on the bar. */
export function secondsAtOffset(offset, width, totalSeconds) {
  const share = Math.min(1, Math.max(0, offset / width));
  return share * totalSeconds;
}

/** Where `seconds` sits along a bar spanning `totalSeconds`, in percent of its width. */
export function offsetPercent(seconds, totalSeconds) {
  return totalSeconds > 0 ? (100 * seconds) / totalSeconds : 0;
}

/**
 * The range after its `handle` ("start" or "end") moves to `seconds`: the other end stays, and the moved one stays
 * within the session and at least `minimumRange` from the other.
 */
export function movedRange(range, handle, seconds, totalSeconds) {
  const minimum = minimumRange(totalSeconds);
  if (handle === "start") {
    return { start: Math.min(Math.max(0, seconds), range.end - minimum), end: range.end };
  }
  return { start: range.start, end: Math.max(Math.min(totalSeconds, seconds), range.start + minimum) };
}

/** The range after an arrow key moves `handle` one step of `KEY_STEP_SHARE` of the session in `direction`, -1 or 1. */
export function steppedRange(range, handle, direction, totalSeconds) {
  const seconds = range[handle] + direction * KEY_STEP_SHARE * totalSeconds;
  return movedRange(range, handle, seconds, totalSeconds);
}

/** "1:00:00–2:00:00 of 6:36:12": the range and the session's length, as the elapsed times are written. */
export function rangeText(range, totalSeconds) {
  return `${formatElapsed(range.start)}–${formatElapsed(range.end)} of ${formatElapsed(totalSeconds)}`;
}

/**
 * The slider over a session `totalSeconds` long, at first spanning all of it. A handle moves as it is dragged, and
 * `onChange(range)` is called when it is let go, or each time an arrow key moves it.
 */
export function rangeSlider(totalSeconds, onChange) {
  const slider = { totalSeconds, onChange, range: { start: 0, end: totalSeconds }, parts: sliderParts() };
  for (const [handle, element] of Object.entries(slider.parts.handles)) {
    element.addEventListener("pointerdown", (event) => element.setPointerCapture(event.pointerId));
    element.addEventListener("pointermove", (event) => dragHandle(slider, handle, event));
    element.addEventListener("lostpointercapture", () => onChange(slider.range));
    element.addEventListener("keydown", (event) => stepHandle(slider, handle, event));
  }
  placeHandles(slider);
  return slider.parts.element;
}

/** Line the slider's bar up with `chart`'s x range, so the session's ends sit under the chart's plot area. */
export function alignToChart(element, chart) {
  const [left, right] = chart.scale("x").range;
  element.style.marginLeft = `${left}px`;
  element.style.width = `${right - left}px`;
}

function sliderParts() {
  const element = classedElement("div", "range-slider");
  const track = classedElement("div", "range-track");
  const selection = classedElement("div", "range-selection");
  const handles = { start: handleElement("start"), end: handleElement("end") };
  const readout = classedElement("p", "range-readout");
  track.append(selection, handles.start, handles.end);
  element.append(track, readout);
  return { element, track, selection, handles, readout };
}

function handleElement(handle) {
  const element = classedElement("div", `range-handle is-${handle}`);
  element.tabIndex = 0;
  element.setAttribute("role", "slider");
  element.setAttribute("aria-label", HANDLE_NAMES[handle]);
  element.setAttribute("aria-valuemin", "0");
  return element;
}

// While a handle holds the pointer, move it to the pointer's place on the bar.
function dragHandle(slider, handle, event) {
  if (!slider.parts.handles[handle].hasPointerCapture(event.pointerId)) {
    return;
  }
  const bounds = slider.parts.track.getBoundingClientRect();
  const seconds = secondsAtOffset(event.clientX - bounds.left, bounds.width, slider.totalSeconds);
  slider.range = movedRange(slider.range, handle, seconds, slider.totalSeconds);
  placeHandles(slider);
}

function stepHandle(slider, handle, event) {
  const direction = KEY_DIRECTIONS[event.key];
  if (direction === undefined) {
    return;
  }
  event.preventDefault();
  slider.range = steppedRange(slider.range, handle, direction, slider.totalSeconds);
  placeHandles(slider);
  slider.onChange(slider.range);
}

// Put the handles, the marked range and the readout where the slider's range says.
function placeHandles({ range, totalSeconds, parts }) {
  const start = offsetPercent(range.start, totalSeconds);
  const end = offsetPercent(range.end, totalSeconds);
  parts.handles.start.style.left = `${start}%`;
  parts.handles.end.style.left = `${end}%`;
  parts.selection.style.left = `${start}%`;
  parts.selection.style.width = `${end - start}%`;
  for (const handle of Object.keys(parts.handles)) {
    parts.handles[handle].setAttribute("aria-valuemax", String(totalSeconds));
    parts.handles[handle].setAttribute("aria-valuenow", String(range[handle]));
    parts.handles[handle].setAttribute("aria-valuetext", formatElapsed(range[handle]));
  }
  parts.readout.textContent = `Time range ${rangeText(range, totalSeconds)}`;
}

function classedElement(tag, className) {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}
