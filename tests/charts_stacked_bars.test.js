import assert from "node:assert/strict";
import { test } from "node:test";

import {
  foldedRows, foldToOther, stackedBarsLegend, sumFolded, weekTicks,
} from "../site/js/charts/stacked_bars.js";
import { barColours } from "../site/js/theme/colours.js";

// Ten harnesses in their colour order: the ninth and tenth fold into Other.
const ORDER = ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10"];
// Nine models in their colour order: the ninth folds into Other.
const NINE_MODELS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];
const ROWS = [
  { week: "2026-06-07", harness: "h1", sessions: 40 },
  { week: "2026-06-07", harness: "h9", sessions: 3 },
  { week: "2026-06-07", harness: "h10", sessions: 2 },
  { week: "2026-06-14", harness: "h10", sessions: 7 },
  { week: "2026-06-14", harness: "h1", sessions: 38 },
];

test("a series past the eighth of the colours folds into Other, summed per week, in order of first appearance", () => {
  const columns = { xColumn: "week", seriesColumn: "harness", valueColumn: "sessions" };
  assert.deepEqual(foldedRows(ROWS, barColours(ORDER), columns), [
    { week: "2026-06-07", harness: "h1", sessions: 40 },
    { week: "2026-06-07", harness: "Other", sessions: 5 },
    { week: "2026-06-14", harness: "Other", sessions: 7 },
    { week: "2026-06-14", harness: "h1", sessions: 38 },
  ]);
});

test("names past the first eight fold into Other, and the rows are not changed in place", () => {
  const rows = [{ model: "m1", requests: 5 }, { model: "m9", requests: 3 }, { model: "unlisted", requests: 1 }];
  const folded = foldToOther(rows, "model", NINE_MODELS);
  assert.deepEqual(folded, [{ model: "m1", requests: 5 }, { model: "Other", requests: 3 }, { model: "Other", requests: 1 }]);
  assert.equal(rows[1].model, "m9");
});

test("folding counts the first eight distinct names, not the first eight entries", () => {
  const names = ["m1", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];
  const folded = foldToOther([{ model: "m8" }, { model: "m9" }], "model", names);
  assert.deepEqual(folded, [{ model: "m8" }, { model: "Other" }]);
});

test("rows sharing a bar and a series are summed into one, in order of first appearance", () => {
  const rows = [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 30 },
    { week: "2026-08-02", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "Other", sessions: 7 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
    { week: "2026-08-09", harness: "Other", sessions: 5 },
  ];
  assert.deepEqual(sumFolded(rows, { xColumn: "week", seriesColumn: "harness", valueColumn: "sessions" }), [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 42 },
    { week: "2026-08-09", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
  ]);
  assert.equal(rows[1].sessions, 30);
});

test("folding then summing leaves one Other row per bar", () => {
  const rows = [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "m9", requests: 4 }, { week: "w1", model: "m10", requests: 5 }];
  const summed = sumFolded(foldToOther(rows, "model", NINE_MODELS), {
    xColumn: "week", seriesColumn: "model", valueColumn: "requests",
  });
  assert.deepEqual(summed, [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "Other", requests: 9 }]);
});

test("a figure of fewer series than colours folds none", () => {
  const parts = new Map([["cached", "a"], ["uncached", "b"], ["unreported", "c"]]);
  const rows = [{ week: "2026-06-07", part: "unreported", tokens: 9 }, { week: "2026-06-07", part: "cached", tokens: 4 }];
  assert.deepEqual(foldedRows(rows, parts, { xColumn: "week", seriesColumn: "part", valueColumn: "tokens" }), rows);
});

test("the legend lists the folded series in the colours' order, Other among them, each by its label", () => {
  const colours = barColours(ORDER);
  const legend = stackedBarsLegend(ROWS, colours, {
    xColumn: "week", seriesColumn: "harness", valueColumn: "sessions", labels: { h1: "One" },
  });
  assert.deepEqual(legend.series, [{ name: "h1", label: "One" }, { name: "Other", label: "Other" }]);
  assert.equal(legend.colours, colours);
});

test("with every week given, each month they span is labelled once; else the first week of each month of the rows", () => {
  const weeks = [
    { week: "2026-05-31", last_day: "2026-06-06" },
    { week: "2026-06-07", last_day: "2026-06-13" },
    { week: "2026-06-14", last_day: "2026-06-20" },
  ];
  const everyWeek = weekTicks(ROWS, "week", weeks);
  assert.deepEqual(weeks.map((entry) => everyWeek(entry.week)), ["May", "Jun", ""]);
  const rowsWeeks = weekTicks(ROWS, "week", undefined);
  assert.deepEqual(["2026-06-07", "2026-06-14"].map(rowsWeeks), ["Jun", ""]);
});
