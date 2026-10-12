import assert from "node:assert/strict";
import { test } from "node:test";

import { FIGURES } from "../site/js/comparison/comparison.js";
import { medianRatioText, scopeMedians } from "../site/js/comparison/scope_cdfs.js";
import { scopeLegend, SCOPES } from "../site/js/comparison/scopes.js";
import { SCOPE_COLOURS } from "../site/js/theme/colours.js";

// Two CDF points of each scope of a turn duration query: the benchmark's median the larger, the human-driven one under
// the axis's floor of one second.
const ROWS = [
  { series: "Agentic", x: 0.2, share: 0, rows: 900, median: 0.5, median_ratio: 376.6 },
  { series: "Agentic", x: 3000, share: 1, rows: 900, median: 0.5, median_ratio: 376.6 },
  { series: "SWE-Bench", x: 20, share: 0, rows: 80, median: 188.3, median_ratio: 376.6 },
  { series: "SWE-Bench", x: 900, share: 1, rows: 80, median: 188.3, median_ratio: 376.6 },
];
const FLOOR = 1;

test("the medians are the scopes' own, smallest first, each drawn no lower than the floor", () => {
  assert.deepEqual(scopeMedians(ROWS, FLOOR), [
    { series: "Agentic", median: 0.5, x: 1 },
    { series: "SWE-Bench", median: 188.3, x: 188.3 },
  ]);
  const reversed = ROWS.map((row) => ({ ...row, median: row.series === "SWE-Bench" ? 0.1 : row.median }));
  assert.deepEqual(scopeMedians(reversed, FLOOR).map((median) => median.series), ["SWE-Bench", "Agentic"]);
});

test("the ratio of the medians is written with one decimal, and only while both scopes are drawn", () => {
  assert.equal(medianRatioText(ROWS), "376.6×");
  assert.equal(medianRatioText(ROWS.filter((row) => row.series === "SWE-Bench")), null);
  assert.equal(medianRatioText([]), null);
  assert.equal(medianRatioText(ROWS.map((row) => ({ ...row, median_ratio: null }))), null);
  assert.equal(medianRatioText(ROWS.map((row) => ({ ...row, median_ratio: Infinity }))), null);
});

test("a scope CDF's legend lists the scopes of the rows, human-driven first, in their colours", () => {
  const legend = scopeLegend(ROWS, {}, "series");
  assert.deepEqual(legend.series, [
    { name: "Agentic", label: "Human-driven" }, { name: "SWE-Bench", label: "Benchmark" },
  ]);
  assert.equal(legend.colours.get("SWE-Bench"), SCOPE_COLOURS["SWE-Bench"]);
  assert.deepEqual(scopeLegend(ROWS.slice(2), {}, "series").series.map((one) => one.name), ["SWE-Bench"]);
});

test("every scope CDF counts each scope's rows under its own noun", () => {
  for (const figure of FIGURES.filter((one) => one.legend === scopeLegend)) {
    assert.deepEqual(Object.keys(figure.seriesNouns), [...SCOPES], figure.name);
  }
  assert.equal(FIGURES.filter((one) => one.legend === scopeLegend).length, 4);
});
