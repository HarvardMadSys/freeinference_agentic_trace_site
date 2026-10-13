import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cdfSeries, dropThinGroups, figureDrawnRows, figureRowsText, hiddenText, partsLegend, restingCountText, restingRowCount,
  seriesLegend, unsimulatedWeeks,
} from "../site/js/figures/figure_rows.js";

// Two CDF series of two points each: `requests` over 120 sessions, `tool_steps` over 30.
const CDF_ROWS = [
  { series: "requests", x: 3, share: 0, rows: 120 },
  { series: "requests", x: 40, share: 1, rows: 120 },
  { series: "tool_steps", x: 0, share: 0, rows: 30 },
  { series: "tool_steps", x: 12, share: 1, rows: 30 },
];

// Three size bins, one row each; the middle one is thin.
const BIN_ROWS = [
  { bin_start: 1, rows: 400 },
  { bin_start: 2, rows: 49 },
  { bin_start: 4, rows: 50 },
];

test("a thin series is hidden whole and counted once", () => {
  assert.deepEqual(dropThinGroups(CDF_ROWS, "series"), { rows: CDF_ROWS.slice(0, 2), hidden: 1 });
});

test("a thin bin of one row is hidden, and a bin of exactly the threshold is kept", () => {
  assert.deepEqual(dropThinGroups(BIN_ROWS, "bin_start"), { rows: [BIN_ROWS[0], BIN_ROWS[2]], hidden: 1 });
});

test("no rows hide no bin", () => {
  assert.deepEqual(dropThinGroups([], "series"), { rows: [], hidden: 0 });
});

test("a figure of bins rests on the sum of its bins' counts", () => {
  assert.equal(restingRowCount(BIN_ROWS, { binColumn: "bin_start" }), 499);
});

test("series drawn from the same rows count those rows once, by the largest series", () => {
  assert.equal(restingRowCount(CDF_ROWS, { binColumn: "series", seriesOverSameRows: true }), 120);
  assert.equal(restingRowCount(CDF_ROWS, { binColumn: "series" }), 150);
  assert.equal(restingRowCount([], { binColumn: "series", seriesOverSameRows: true }), 0);
});

test("a caption counts a figure's rows, or each series under its own noun when the series count different things", () => {
  assert.equal(restingCountText(BIN_ROWS, { binColumn: "bin_start" }), "499 rows");
  const nouns = { tool_steps: "tool steps", requests: "requests", user_steps: "user steps" };
  const figure = { binColumn: "series", seriesNouns: nouns };
  assert.equal(restingCountText(CDF_ROWS, figure), "30 tool steps · 120 requests");
  assert.equal(restingCountText([], figure), "0 rows");
});

test("the hidden note names what was hidden, in the singular or the plural", () => {
  assert.equal(hiddenText(0, "bin_start"), "");
  assert.equal(hiddenText(1, "bin_start"), "1 bin hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(3, "bin_start"), "3 bins hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(2, "series"), "2 series hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(1, "week"), "1 week hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(2, "waited_for"), "2 causes hidden (fewer than 50 rows each)");
});

test("CDF rows become series in the order of the names given, with a missing series left out", () => {
  assert.deepEqual(cdfSeries(CDF_ROWS, ["tool_steps", "user_steps", "requests"]), [
    { name: "tool_steps", label: "tool_steps", points: [{ x: 0, share: 0 }, { x: 12, share: 1 }] },
    { name: "requests", label: "requests", points: [{ x: 3, share: 0 }, { x: 40, share: 1 }] },
  ]);
});

test("a CDF series keeps its name and is labelled by its label where it has one", () => {
  const series = cdfSeries(CDF_ROWS, ["requests", "tool_steps"], { labels: { tool_steps: "Tool steps" } });
  assert.deepEqual(series.map((one) => one.name), ["requests", "tool_steps"]);
  assert.deepEqual(series.map((one) => one.label), ["requests", "Tool steps"]);
});

test("a legend lists the series the rows hold, in the colours' order, each labelled where it has a label", () => {
  const colours = new Map([["requests", "red"], ["user_steps", "blue"], ["tool_steps", "green"]]);
  const legend = seriesLegend(CDF_ROWS, "series", colours, { tool_steps: "Tool steps" });
  assert.deepEqual(legend.series, [{ name: "requests", label: "requests" }, { name: "tool_steps", label: "Tool steps" }]);
  assert.equal(legend.colours, colours);
});

test("a CDF value below the floor is drawn at the floor", () => {
  const [toolSteps] = cdfSeries(CDF_ROWS, ["tool_steps"], { floor: 1 });
  assert.deepEqual(toolSteps.points, [{ x: 1, share: 0 }, { x: 12, share: 1 }]);
});

test("with no bin column every row is a bin of its own, hidden alone and counted alone", () => {
  const rows = [
    { provider: "A", idle_gap_bin: 0, rows: 400 },
    { provider: "A", idle_gap_bin: 1, rows: 49 },
    { provider: "B", idle_gap_bin: 0, rows: 60 },
  ];
  assert.deepEqual(dropThinGroups(rows, null), { rows: [rows[0], rows[2]], hidden: 1 });
  assert.equal(restingRowCount(rows, { binColumn: null }), 509);
  assert.equal(hiddenText(2, null), "2 bins hidden (fewer than 50 rows each)");
});

// Three weeks of `weeks.json`, the last not simulated.
const WEEK_ENTRIES = [
  { week: "2026-08-02", simulated: true },
  { week: "2026-08-09", simulated: true },
  { week: "2026-08-16", simulated: false },
];
test("a figure of the trace leaves no week unsimulated; a simulation figure names the weeks not simulated", () => {
  assert.deepEqual(unsimulatedWeeks({}, WEEK_ENTRIES), []);
  assert.deepEqual(unsimulatedWeeks({ isSimulation: true }, WEEK_ENTRIES), ["2026-08-16"]);
  assert.deepEqual(unsimulatedWeeks({ isPartlySimulated: true }, WEEK_ENTRIES), ["2026-08-16"]);
});

test("a figure draws the rows its drawnRows keeps given the shared colours, or every row without one", () => {
  const colours = { providers: new Map([["A", "red"]]) };
  const keepsColoured = { drawnRows: (rows, shared) => rows.filter((row) => shared.providers.has(row.provider)) };
  const rows = [{ provider: "A" }, { provider: "B" }];
  assert.deepEqual(figureDrawnRows(keepsColoured, rows, colours), [{ provider: "A" }]);
  assert.deepEqual(figureDrawnRows({}, rows, colours), rows);
});

test("a figure's line of rows counts its rows, names the weeks not simulated and notes hidden bins, never the population", () => {
  const simulation = { isSimulation: true, binColumn: "ttl", seriesOverSameRows: true };
  assert.equal(figureRowsText(simulation, [{ ttl: "5m", rows: 1200 }], 0, ["2026-08-16"]),
    "1,200 rows · not simulated: 2026-08-16");
  const byWeek = { binColumn: "week" };
  assert.equal(figureRowsText(byWeek, [{ week: "2026-08-16", rows: 60 }], 2, []),
    "60 rows · 2 weeks hidden (fewer than 50 rows each)");
});

test("a legend of parts lists each part with its label, in order, with the colours given", () => {
  const colours = new Map([["cached", "green"], ["uncached", "orange"], ["output", "blue"]]);
  const legend = partsLegend({ cached: "Cached input", uncached: "Uncached input", output: "Output" }, colours);
  assert.deepEqual(legend.series, [
    { name: "cached", label: "Cached input" },
    { name: "uncached", label: "Uncached input" },
    { name: "output", label: "Output" },
  ]);
  assert.equal(legend.colours, colours);
});
