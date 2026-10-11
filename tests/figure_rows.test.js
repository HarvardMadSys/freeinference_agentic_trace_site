import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cdfSeries,
  drawnHarnessesAndWeeks,
  dropThinGroups,
  figureCaption,
  figureDrawnRows,
  hiddenText,
  restingCountText,
  restingRowCount,
  seriesLegend,
  sparseTickFormat,
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

test("a crowded axis labels every step-th value from the first, at most the number asked", () => {
  const format = sparseTickFormat(["a", "b", "c", "d", "e", "f", "g"], (value) => value.toUpperCase(), 3);
  assert.deepEqual(["a", "b", "c", "d", "e", "f", "g"].map(format), ["A", "", "", "D", "", "", "G"]);
});

test("an axis with room for every value labels them all", () => {
  const format = sparseTickFormat([1, 2, 4], String, 6);
  assert.deepEqual([1, 2, 4].map(format), ["1", "2", "4"]);
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
// Three harnesses of `harnesses.json`, the second the benchmark.
const HARNESS_ENTRIES = [
  { harness: "hermes", sessions: 30, benchmark: false },
  { harness: "eval:swe-bench", sessions: 20, benchmark: true },
  { harness: "codex", sessions: 10, benchmark: false },
];

test("a figure draws the selection's harnesses and weeks", () => {
  const selection = { harnesses: ["codex"], weeks: ["2026-08-09", "2026-08-16"] };
  assert.deepEqual(drawnHarnessesAndWeeks({}, selection, WEEK_ENTRIES, HARNESS_ENTRIES), {
    harnesses: "codex",
    weeks: ["2026-08-09", "2026-08-16"],
    notSimulated: [],
  });
});

test("a simulation figure draws the paper's harnesses in the selected weeks that were simulated, and says so", () => {
  const figure = { isSimulation: true };
  const paperSelection = { harnesses: ["hermes", "codex"], weeks: ["2026-08-09", "2026-08-16"] };
  assert.deepEqual(drawnHarnessesAndWeeks(figure, paperSelection, WEEK_ENTRIES, HARNESS_ENTRIES), {
    harnesses: "the paper's harnesses",
    weeks: ["2026-08-09"],
    notSimulated: ["2026-08-16"],
  });
  const benchmarkSelection = { harnesses: ["eval:swe-bench"], weeks: ["2026-08-02"] };
  const underBenchmark = drawnHarnessesAndWeeks(figure, benchmarkSelection, WEEK_ENTRIES, HARNESS_ENTRIES);
  assert.equal(underBenchmark.harnesses, "the paper's harnesses only, which the simulation replays");
  assert.deepEqual(underBenchmark.weeks, ["2026-08-02"]);
});

test("a figure draws the rows its drawnRows keeps given the shared colours, or every row without one", () => {
  const colours = { providers: new Map([["A", "red"]]) };
  const keepsColoured = { drawnRows: (rows, shared) => rows.filter((row) => shared.providers.has(row.provider)) };
  const rows = [{ provider: "A" }, { provider: "B" }];
  assert.deepEqual(figureDrawnRows(keepsColoured, rows, colours), [{ provider: "A" }]);
  assert.deepEqual(figureDrawnRows({}, rows, colours), rows);
});

test("a simulation figure's caption names the selected weeks the simulation does not cover", () => {
  const figure = { isSimulation: true, binColumn: "ttl", seriesOverSameRows: true };
  const selection = { harnesses: ["hermes", "codex"], weeks: ["2026-08-02", "2026-08-09", "2026-08-16"] };
  const drawn = drawnHarnessesAndWeeks(figure, selection, WEEK_ENTRIES, HARNESS_ENTRIES);
  const rows = [{ ttl: "5m", rows: 1200 }];
  assert.equal(figureCaption(figure, rows, 0, drawn),
    "1,200 rows · the paper's harnesses · 2 weeks · not simulated: 2026-08-16");
});

test("a figure's caption names no week left out when every selected week is drawn, and notes hidden bins", () => {
  const figure = { binColumn: "week" };
  const selection = { harnesses: ["codex"], weeks: ["2026-08-16"] };
  const drawn = drawnHarnessesAndWeeks(figure, selection, WEEK_ENTRIES, HARNESS_ENTRIES);
  const rows = [{ week: "2026-08-16", rows: 60 }];
  assert.equal(figureCaption(figure, rows, 2, drawn),
    "60 rows · codex · 1 week (2026-08-16) · 2 weeks hidden (fewer than 50 rows each)");
});
