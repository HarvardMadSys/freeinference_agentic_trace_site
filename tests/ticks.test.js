import assert from "node:assert/strict";
import { test } from "node:test";

import {
  atMost, axisWithTicks, fewerOnNarrow, tickCountFor, decadeDomain, decadeTicks, durationTicks, elapsedAxis, elapsedTicks, everyOther, firstWeekOfEachMonth,
  isNarrowChart, logAxisTicks, MAX_TICKS, maxTicksFor, monthTickFormat, NARROW_MAX_TICKS, percentTick, sparseTickFormat,
  tickCount, weekTickFormat,
} from "../site/js/axes/ticks.js";

test("a log axis ticks its powers of ten, every other one past six, and leaves a range of one power to Plot", () => {
  assert.deepEqual(logAxisTicks([1, 1e5]), [1, 10, 100, 1e3, 1e4, 1e5]);
  assert.deepEqual(logAxisTicks([1, 1e7]), [1, 100, 1e4, 1e6]);
  assert.equal(logAxisTicks([2, 50]), undefined);
});

test("the powers of ten of a range, and the powers of ten around a set of values", () => {
  assert.deepEqual(decadeTicks([1e4, 3e8]), [1e4, 1e5, 1e6, 1e7, 1e8]);
  assert.deepEqual(decadeTicks([1, 100]), [1, 10, 100]);
  assert.deepEqual(decadeDomain([150, 420000]), [100, 1e6]);
});

test("a duration axis ticks at the durations people count in, at most six of them", () => {
  assert.deepEqual(durationTicks([0.1, 86400]), [0.1, 1, 60, 3600, 86400]);
  assert.deepEqual(logAxisTicks([1e4, 1e8], 4), [1e4, 1e6, 1e8]);
  assert.deepEqual(durationTicks([0.5, 300]), [1, 60]);
  assert.ok(durationTicks([0.001, 1e7]).length <= MAX_TICKS);
});

test("a crowded axis labels every step-th value from the first, at most the number asked", () => {
  const format = sparseTickFormat(["a", "b", "c", "d", "e", "f", "g"], (value) => value.toUpperCase(), 3);
  assert.deepEqual(["a", "b", "c", "d", "e", "f", "g"].map(format), ["A", "", "", "D", "", "", "G"]);
});

test("an axis with room for every value labels them all", () => {
  const format = sparseTickFormat([1, 2, 4], String, 6);
  assert.deepEqual([1, 2, 4].map(format), ["1", "2", "4"]);
});

test("a percentage axis writes its ticks as they are, with a percent sign", () => {
  assert.deepEqual([0, 50, 100].map(percentTick), ["0%", "50%", "100%"]);
});

test("a week axis labels the first week of each month with its month alone", () => {
  const weeks = ["2026-05-03", "2026-05-10", "2026-05-31", "2026-06-07"];
  assert.deepEqual(firstWeekOfEachMonth(weeks), ["2026-05-03", "2026-06-07"]);
  const format = weekTickFormat(weeks);
  assert.deepEqual(weeks.map(format), ["May", "", "", "Jun"]);
});

test("an axis given its ticks writes each as its text, so a log axis blanks none; without ticks Plot chooses them", () => {
  const makeAxis = (...args) => args;
  const format = (seconds) => `${seconds} s`;
  const [ticks, options] = axisWithTicks(makeAxis, [1, 60], { stroke: "grey", tickFormat: format });
  assert.deepEqual(ticks, [1, 60]);
  assert.equal(options.text(60), "60 s");
  assert.equal(options.tickFormat, undefined);
  assert.deepEqual(axisWithTicks(makeAxis, undefined, { stroke: "grey", tickFormat: format }), [
    { stroke: "grey", tickFormat: format },
  ]);
  assert.deepEqual(axisWithTicks(makeAxis, [1, 10], { stroke: "grey" }), [[1, 10], { stroke: "grey" }]);
});

test("an elapsed axis ticks by the smallest round step that fits", () => {
  assert.deepEqual(elapsedTicks([0, 50], 5), [0, 10, 20, 30, 40, 50]);
  assert.deepEqual(elapsedTicks([0, 3000], 4), [0, 900, 1800, 2700]);
  assert.deepEqual(elapsedTicks([0, 4 * 3600], 4), [0, 3600, 7200, 10800, 14400]);
});

test("an axis longer than a week of ticks steps by whole seconds", () => {
  const ticks = elapsedTicks([0, 10 * 604800], 2);
  assert.deepEqual(ticks, [0, 3024000, 6048000]);
});

test("an elapsed axis over a range ticks the round steps within it, by the range's span", () => {
  assert.deepEqual(elapsedTicks([3600, 7200], 4), [3600, 4500, 5400, 6300, 7200]);
  assert.deepEqual(elapsedTicks([100, 160], 6), [100, 110, 120, 130, 140, 150, 160]);
  assert.deepEqual(elapsedTicks([95, 155], 6), [100, 110, 120, 130, 140, 150]);
});

test("past an hour, an axis whose ticks fall between whole minutes writes their seconds", () => {
  const narrow = elapsedAxis([3600, 3660], 540);
  assert.equal(narrow.label, "Time since first request (h:mm:ss)");
  assert.deepEqual(narrow.ticks.map(narrow.tickFormat).slice(0, 2), ["1:00:00", "1:00:10"]);
  const hour = elapsedAxis([3600, 7200], 540);
  assert.equal(hour.label, "Time since first request (h:mm)");
  assert.equal(hour.tickFormat(5400), "1:30");
});

test("a session of no time has the one tick at zero", () => {
  assert.deepEqual(elapsedTicks([0, 0], 5), [0]);
});

test("an axis holds a tick per 90 pixels, at least two and at most six", () => {
  assert.equal(tickCount(900), 6);
  assert.equal(tickCount(450), 5);
  assert.equal(tickCount(100), 2);
});

test("an elapsed axis writes hours and minutes from an hour on, else minutes and seconds, and says which", () => {
  const long = elapsedAxis([0, 4200], 540);
  assert.equal(long.label, "Time since first request (h:mm)");
  assert.deepEqual(long.ticks.map(long.tickFormat), ["0:00", "0:15", "0:30", "0:45", "1:00"]);
  const short = elapsedAxis([0, 750], 300);
  assert.equal(short.label, "Time since first request (m:ss)");
  assert.equal(short.tickFormat(300), "5:00");
});

test("a narrow chart's axes take at most three ticks, a wide one's six; every other tick halves a list", () => {
  assert.equal(isNarrowChart(300), true);
  assert.equal(isNarrowChart(520), false);
  assert.equal(maxTicksFor(300), NARROW_MAX_TICKS);
  assert.equal(maxTicksFor(520), MAX_TICKS);
  assert.deepEqual(everyOther([0.1, 1, 60]), [0.1, 60]);
  assert.deepEqual(durationTicks([0.05, 1000], NARROW_MAX_TICKS), [0.1, 1, 60]);
  assert.deepEqual(durationTicks([0.05, 4000], NARROW_MAX_TICKS), [0.1, 60]);
});

test("a week axis leaves out a month whose first week is under four weeks before the next month's", () => {
  const weeks = ["2026-05-17", "2026-05-24", "2026-05-31", "2026-06-07", "2026-07-05", "2026-08-02"];
  assert.deepEqual(firstWeekOfEachMonth(weeks), ["2026-06-07", "2026-07-05", "2026-08-02"]);
});

test("a narrow chart's axes thin their ticks in one place: at most so many, every other, or a smaller count", () => {
  assert.deepEqual(atMost([1, 3, 10, 30], 6), [1, 3, 10, 30]);
  assert.deepEqual(atMost([1, 3, 10, 30], 3), [1, 10]);
  assert.deepEqual(fewerOnNarrow([0.1, 1, 60], 300), [0.1, 60]);
  assert.deepEqual(fewerOnNarrow([0.1, 1, 60], 520), [0.1, 1, 60]);
  assert.equal(tickCountFor(300, 5), NARROW_MAX_TICKS);
  assert.equal(tickCountFor(520, 5), 5);
});

test("a trend's axis labels every month its weeks span, the first and the last, on its first Sunday's week", () => {
  const weeks = [
    { week: "2026-05-17", last_day: "2026-05-23" }, { week: "2026-05-24", last_day: "2026-05-30" },
    { week: "2026-05-31", last_day: "2026-06-06" }, { week: "2026-06-07", last_day: "2026-06-13" },
    { week: "2026-08-23", last_day: "2026-08-29" }, { week: "2026-08-30", last_day: "2026-09-05" },
  ];
  const format = monthTickFormat(weeks);
  assert.deepEqual(weeks.map((entry) => format(entry.week)), ["May", "", "", "Jun", "Aug", "Sep"]);
  const oneWeek = monthTickFormat([{ week: "2026-01-31", last_day: "2026-02-06" }]);
  assert.equal(oneWeek("2026-01-31"), "Jan");
});
