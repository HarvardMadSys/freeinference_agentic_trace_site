import assert from "node:assert/strict";
import { test } from "node:test";

import {
  KEY_STEP_SHARE, MIN_RANGE_SHARE, minimumRange, movedRange, offsetPercent, rangeText, secondsAtOffset, steppedRange,
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
