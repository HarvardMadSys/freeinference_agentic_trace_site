import assert from "node:assert/strict";
import { test } from "node:test";

import { elapsedAxis, elapsedTicks, tickCount } from "../site/js/session/view_chart.js";

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

test("an axis holds a tick per 90 pixels, at least two and at most six", () => {
  assert.equal(tickCount(900), 6);
  assert.equal(tickCount(450), 5);
  assert.equal(tickCount(100), 2);
});

test("an elapsed axis writes hours and minutes from an hour on, else minutes and seconds, and says which", () => {
  const long = elapsedAxis(4200, 540);
  assert.equal(long.label, "Time since first request (h:mm)");
  assert.deepEqual(long.ticks.map(long.tickFormat), ["0:00", "0:15", "0:30", "0:45", "1:00"]);
  const short = elapsedAxis(750, 300);
  assert.equal(short.label, "Time since first request (m:ss)");
  assert.equal(short.tickFormat(300), "5:00");
});
