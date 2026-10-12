import assert from "node:assert/strict";
import { test } from "node:test";

import {
  barOpacity, clickHint, columnTotal, labelledWeeks, tokenPartRows, weekTick,
} from "../site/js/explore/trends.js";

test("each week's input becomes three rows, cached first, in the weeks' order", () => {
  const weekRows = [
    { week: "2026-05-31", requests: 10, cached_tokens: 12100, uncached_tokens: 6500, unreported_tokens: 1800 },
    { week: "2026-06-07", requests: 6, cached_tokens: 3300, uncached_tokens: 4800, unreported_tokens: 0 },
  ];
  assert.deepEqual(tokenPartRows(weekRows), [
    { week: "2026-05-31", part: "cached", tokens: 12100 },
    { week: "2026-05-31", part: "uncached", tokens: 6500 },
    { week: "2026-05-31", part: "unreported", tokens: 1800 },
    { week: "2026-06-07", part: "cached", tokens: 3300 },
    { week: "2026-06-07", part: "uncached", tokens: 4800 },
    { week: "2026-06-07", part: "unreported", tokens: 0 },
  ]);
});

test("the first week of each month is labelled", () => {
  const weeks = [
    { week: "2026-05-24", month: "2026-05" },
    { week: "2026-05-31", month: "2026-05" },
    { week: "2026-06-07", month: "2026-06" },
    { week: "2026-06-14", month: "2026-06" },
  ];
  assert.deepEqual(labelledWeeks(weeks), ["2026-05-24", "2026-06-07"]);
});

test("a labelled week's tick is its Sunday's month and day, and any other week's tick is empty", () => {
  assert.equal(weekTick("2026-08-09", ["2026-08-09"]), "08-09");
  assert.equal(weekTick("2026-08-16", ["2026-08-09"]), "");
});

test("a selected week's bar is solid and any other is faint", () => {
  const selectedWeeks = ["2026-08-09", "2026-08-16"];
  assert.equal(barOpacity({ week: "2026-08-16" }, selectedWeeks), 1);
  const faint = barOpacity({ week: "2026-08-23" }, selectedWeeks);
  assert.ok(faint > 0 && faint < 1);
});

test("a trend's definition ends with the click hint only while a bar click selects a week", () => {
  const hint = " Faint bars are weeks outside the selection; click a bar to select its week alone.";
  assert.equal(clickHint(() => undefined), hint);
  assert.equal(clickHint(null), "");
});

test("a column's total sums it over the rows, and is 0 for no rows", () => {
  assert.equal(columnTotal([{ sessions: 3 }, { sessions: 4 }], "sessions"), 7);
  assert.equal(columnTotal([], "sessions"), 0);
});
