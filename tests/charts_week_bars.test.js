import assert from "node:assert/strict";
import { test } from "node:test";

import { foldedWeekRows, weekBarsLegend, weekTicks } from "../site/js/charts/week_bars.js";
import { barColours } from "../site/js/theme/colours.js";

// Ten harnesses in their colour order: the ninth and tenth fold into Other.
const ORDER = ["h1", "h2", "h3", "h4", "h5", "h6", "h7", "h8", "h9", "h10"];
const ROWS = [
  { week: "2026-06-07", harness: "h1", sessions: 40 },
  { week: "2026-06-07", harness: "h9", sessions: 3 },
  { week: "2026-06-07", harness: "h10", sessions: 2 },
  { week: "2026-06-14", harness: "h10", sessions: 7 },
  { week: "2026-06-14", harness: "h1", sessions: 38 },
];

test("a series past the eighth of the colours folds into Other, summed per week, in order of first appearance", () => {
  assert.deepEqual(foldedWeekRows(ROWS, "harness", "sessions", barColours(ORDER)), [
    { week: "2026-06-07", harness: "h1", sessions: 40 },
    { week: "2026-06-07", harness: "Other", sessions: 5 },
    { week: "2026-06-14", harness: "Other", sessions: 7 },
    { week: "2026-06-14", harness: "h1", sessions: 38 },
  ]);
});

test("a figure of fewer series than colours folds none", () => {
  const parts = new Map([["cached", "a"], ["uncached", "b"], ["unreported", "c"]]);
  const rows = [{ week: "2026-06-07", part: "unreported", tokens: 9 }, { week: "2026-06-07", part: "cached", tokens: 4 }];
  assert.deepEqual(foldedWeekRows(rows, "part", "tokens", parts), rows);
});

test("the legend lists the folded series in the colours' order, Other among them, each by its label", () => {
  const colours = barColours(ORDER);
  const legend = weekBarsLegend(ROWS, colours, { seriesColumn: "harness", valueColumn: "sessions", labels: { h1: "One" } });
  assert.deepEqual(legend.series, [{ name: "h1", label: "One" }, { name: "Other", label: "Other" }]);
  assert.equal(legend.colours, colours);
});

test("with every week given, each month they span is labelled once; else the first week of each month of the rows", () => {
  const weeks = [
    { week: "2026-05-31", last_day: "2026-06-06" },
    { week: "2026-06-07", last_day: "2026-06-13" },
    { week: "2026-06-14", last_day: "2026-06-20" },
  ];
  const everyWeek = weekTicks(ROWS, weeks);
  assert.deepEqual(weeks.map((entry) => everyWeek(entry.week)), ["May", "Jun", ""]);
  const rowsWeeks = weekTicks(ROWS, undefined);
  assert.deepEqual(["2026-06-07", "2026-06-14"].map(rowsWeeks), ["Jun", ""]);
});
