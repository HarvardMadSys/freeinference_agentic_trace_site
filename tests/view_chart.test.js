import assert from "node:assert/strict";
import { test } from "node:test";

import { elapsedSeconds, elapsedTicks, tickCount } from "../site/js/session/view_chart.js";

test("elapsed time is in seconds from the origin", () => {
  assert.equal(elapsedSeconds(1_001_500, 1_000_000), 1.5);
  assert.equal(elapsedSeconds(1_000_000, 1_000_000), 0);
});

test("an elapsed axis ticks by the smallest round step that fits", () => {
  assert.deepEqual(elapsedTicks(50, 5), [0, 10, 20, 30, 40, 50]);
  assert.deepEqual(elapsedTicks(3000, 4), [0, 900, 1800, 2700]);
  assert.deepEqual(elapsedTicks(4 * 3600, 4), [0, 3600, 7200, 10800, 14400]);
});

test("an axis longer than a week of ticks steps by whole seconds", () => {
  const ticks = elapsedTicks(10 * 604800, 2);
  assert.deepEqual(ticks, [0, 3024000, 6048000]);
});

test("a session of no time has the one tick at zero", () => {
  assert.deepEqual(elapsedTicks(0, 5), [0]);
});

test("an axis holds a tick per 90 pixels, and at least two", () => {
  assert.equal(tickCount(900), 10);
  assert.equal(tickCount(100), 2);
});
