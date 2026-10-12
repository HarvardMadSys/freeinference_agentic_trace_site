/**
 * The range slider under the Context and Timeline charts: a thin bar spanning the session's elapsed time, the chosen
 * range marked on it between two handles, which a pointer drags and the arrow keys move. A range is `{ start, end }`
 * in seconds since the session's first request. The arithmetic is plain functions, tested with `node --test`;
 * `rangeSlider` draws the strip and calls back with each range chosen.
 */

import { elapsedTickFormat, formatElapsed, formatHours } from "../shared/format.js";

const SECONDS_PER_DAY = 86400; // a session this long or longer reads its range in hours

/** The narrowest range, as a share of the session: narrower, the two handles would sit on one another. */
export const MIN_RANGE_SHARE = 0.01;
/** How far an arrow key moves a focused handle, as a share of the session. */
export const KEY_STEP_SHARE = 0.01;

// Each handle, the end of the range it moves, and what a screen reader calls it.
const HANDLE_NAMES = Object.freeze({ start: "Start of the time range", end: "End of the time range" });

// The arrow keys that move a focused handle one step, each with the direction it moves it: earlier or later.
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

/**
 * The range after `key` is pressed on the focused `handle`: an arrow key moves it one step, Home as early and End as
 * late as it may go; null for any other key.
 */
export function keyedRange(range, handle, key, totalSeconds) {
  if (key === "Home") {
    return movedRange(range, handle, 0, totalSeconds);
  }
  if (key === "End") {
    return movedRange(range, handle, totalSeconds, totalSeconds);
  }
  const direction = KEY_DIRECTIONS[key];
  return direction === undefined ? null : steppedRange(range, handle, direction, totalSeconds);
}

/**
 * `{ min, max }`, the seconds `handle` may move between with the other end where it is: the start from 0 to the
 * minimum range before the end, the end from the minimum range after the start to the session's end.
 */
export function handleBounds(range, handle, totalSeconds) {
  const minimum = minimumRange(totalSeconds);
  if (handle === "start") {
    return { min: 0, max: range.end - minimum };
  }
  return { min: range.start + minimum, max: totalSeconds };
}

/** Whether the ranges `first` and `second` start and end at the same seconds. */
export function isSameRange(first, second) {
  return first.start === second.start && first.end === second.end;
}

/**
 * The range and the session's length in the unit the time axis uses, named: "1:00–2:00 of 6:36 (h:mm)", "2:30–5:00 of
 * 12:00 (m:ss)"; a session of a day or more in hours with one decimal, "29.7 h–59.4 h of 98.9 h".
 */
export function rangeText(range, totalSeconds) {
  if (totalSeconds >= SECONDS_PER_DAY) {
    return `${formatHours(range.start)}–${formatHours(range.end)} of ${formatHours(totalSeconds)}`;
  }
  const { format, unit } = elapsedTickFormat(totalSeconds);
  return `${format(range.start)}–${format(range.end)} of ${format(totalSeconds)} (${unit})`;
}

/**
 * The slider over a session `totalSeconds` long, at first spanning all of it. A handle moves as it is dragged, and
 * `onChange(range)` is called when it is let go somewhere new, or each time a key moves it.
 */
export function rangeSlider(totalSeconds, onChange) {
  const whole = { start: 0, end: totalSeconds };
  const slider = { totalSeconds, onChange, range: whole, rangeAtGrab: whole, parts: sliderParts() };
  for (const [handle, element] of Object.entries(slider.parts.handles)) {
    element.addEventListener("pointerdown", (event) => grabHandle(slider, element, event));
    element.addEventListener("pointermove", (event) => dragHandle(slider, handle, event));
    element.addEventListener("lostpointercapture", () => letGoOfHandle(slider));
    element.addEventListener("keydown", (event) => keyHandle(slider, handle, event));
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
  return element;
}

// A handle takes the pointer, and the slider keeps the range it had, to tell on letting go whether it moved.
function grabHandle(slider, element, event) {
  element.setPointerCapture(event.pointerId);
  slider.rangeAtGrab = slider.range;
}

// A handle let go where it was grabbed, a click without a drag, leaves the chart as it is.
function letGoOfHandle(slider) {
  if (!isSameRange(slider.range, slider.rangeAtGrab)) {
    slider.onChange(slider.range);
  }
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

function keyHandle(slider, handle, event) {
  const range = keyedRange(slider.range, handle, event.key, slider.totalSeconds);
  if (range === null) {
    return;
  }
  event.preventDefault();
  if (isSameRange(range, slider.range)) {
    return;
  }
  slider.range = range;
  placeHandles(slider);
  slider.onChange(range);
}

// Put the handles, the marked range and the readout where the slider's range says.
function placeHandles({ range, totalSeconds, parts }) {
  const start = offsetPercent(range.start, totalSeconds);
  const end = offsetPercent(range.end, totalSeconds);
  parts.handles.start.style.left = `${start}%`;
  parts.handles.end.style.left = `${end}%`;
  parts.selection.style.left = `${start}%`;
  parts.selection.style.width = `${end - start}%`;
  for (const [handle, element] of Object.entries(parts.handles)) {
    const bounds = handleBounds(range, handle, totalSeconds);
    element.setAttribute("aria-valuemin", String(Math.round(bounds.min)));
    element.setAttribute("aria-valuemax", String(Math.round(bounds.max)));
    element.setAttribute("aria-valuenow", String(Math.round(range[handle])));
    element.setAttribute("aria-valuetext", formatElapsed(range[handle]));
  }
  // The words "Time range" are left out on a phone (`.range-readout-name`), so the readout keeps to one line.
  const name = classedElement("span", "range-readout-name");
  name.textContent = "Time range ";
  parts.readout.replaceChildren(name, rangeText(range, totalSeconds));
}

function classedElement(tag, className) {
  const element = document.createElement(tag);
  element.className = className;
  return element;
}
