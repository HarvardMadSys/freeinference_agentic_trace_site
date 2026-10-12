import assert from "node:assert/strict";
import { test } from "node:test";

import {
  handleBounds, isSameRange, KEY_STEP_SHARE, keyedRange, MIN_RANGE_SHARE, minimumRange, movedRange, offsetPercent,
  rangeText, secondsAtOffset, steppedRange,
} from "../site/js/session_charts/range_slider.js";

const DAY = 86_400; // seconds: a day-long session
const WHOLE_DAY = Object.freeze({ start: 0, end: DAY });

test("a handle's place on the bar and its seconds turn into one another", () => {
  assert.equal(secondsAtOffset(250, 1_000, DAY), DAY / 4);
  assert.equal(offsetPercent(DAY / 4, DAY), 25);
  assert.equal(offsetPercent(secondsAtOffset(600, 800, 3_600), 3_600), 75);
});

test("a pointer past either end of the bar holds the handle at that end", () => {
  assert.equal(secondsAtOffset(-40, 1_000, DAY), 0);
  assert.equal(secondsAtOffset(1_200, 1_000, DAY), DAY);
});

test("a session of no time puts both handles at the bar's start", () => {
  assert.equal(offsetPercent(0, 0), 0);
});

test("moving a handle moves its end of the range alone", () => {
  assert.deepEqual(movedRange(WHOLE_DAY, "start", 3_600, DAY), { start: 3_600, end: DAY });
  assert.deepEqual(movedRange({ start: 3_600, end: DAY }, "end", 7_200, DAY), { start: 3_600, end: 7_200 });
});

test("the range keeps within the session", () => {
  assert.deepEqual(movedRange(WHOLE_DAY, "start", -100, DAY), WHOLE_DAY);
  assert.deepEqual(movedRange(WHOLE_DAY, "end", DAY + 100, DAY), WHOLE_DAY);
});

test("the range is never narrower than its minimum share of the session", () => {
  assert.equal(minimumRange(DAY), DAY * MIN_RANGE_SHARE);
  const hour = { start: 3_600, end: 7_200 };
  assert.deepEqual(movedRange(hour, "start", 7_200, DAY), { start: 7_200 - minimumRange(DAY), end: 7_200 });
  assert.deepEqual(movedRange(hour, "end", 0, DAY), { start: 3_600, end: 3_600 + minimumRange(DAY) });
});

test("an arrow key moves a handle one step of the session, and stops at the session's ends", () => {
  const step = KEY_STEP_SHARE * DAY;
  assert.deepEqual(steppedRange(WHOLE_DAY, "start", 1, DAY), { start: step, end: DAY });
  assert.deepEqual(steppedRange(WHOLE_DAY, "end", -1, DAY), { start: 0, end: DAY - step });
  assert.deepEqual(steppedRange(WHOLE_DAY, "start", -1, DAY), WHOLE_DAY);
  assert.deepEqual(steppedRange(WHOLE_DAY, "end", 1, DAY), WHOLE_DAY);
});

test("the readout gives the range and the session's length as elapsed times", () => {
  assert.equal(rangeText({ start: 3_600, end: 7_200 }, 23_772), "1:00:00–2:00:00 of 6:36:12");
});

test("Home and End move a handle as far as it may go; an arrow key one step; any other key nothing", () => {
  const hour = { start: 3_600, end: 7_200 };
  assert.deepEqual(keyedRange(hour, "start", "Home", DAY), { start: 0, end: 7_200 });
  assert.deepEqual(keyedRange(hour, "start", "End", DAY), { start: 7_200 - minimumRange(DAY), end: 7_200 });
  assert.deepEqual(keyedRange(hour, "end", "Home", DAY), { start: 3_600, end: 3_600 + minimumRange(DAY) });
  assert.deepEqual(keyedRange(hour, "end", "End", DAY), { start: 3_600, end: DAY });
  assert.deepEqual(keyedRange(hour, "end", "ArrowUp", DAY), steppedRange(hour, "end", 1, DAY));
  assert.equal(keyedRange(hour, "end", "Enter", DAY), null);
});

test("each handle's bounds keep the minimum range from the other end", () => {
  const hour = { start: 3_600, end: 7_200 };
  assert.deepEqual(handleBounds(hour, "start", DAY), { min: 0, max: 7_200 - minimumRange(DAY) });
  assert.deepEqual(handleBounds(hour, "end", DAY), { min: 3_600 + minimumRange(DAY), max: DAY });
});

test("a range let go where it was grabbed is the same range", () => {
  assert.equal(isSameRange(WHOLE_DAY, { start: 0, end: DAY }), true);
  assert.equal(isSameRange(WHOLE_DAY, { start: 1, end: DAY }), false);
});
