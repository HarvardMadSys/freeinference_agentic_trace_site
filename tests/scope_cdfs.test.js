import assert from "node:assert/strict";
import { test } from "node:test";

import {
  INPUT_PER_REQUEST_BY_SCOPE, medianComparison, medianRatioText, medianSummary, scopeMedians, SESSION_DURATION_BY_SCOPE,
  TURN_DURATION_BY_SCOPE, USER_PROMPT_TOKENS_BY_SCOPE,
} from "../site/js/comparison/scope_cdfs.js";
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
  const scopeCdfs = [TURN_DURATION_BY_SCOPE, SESSION_DURATION_BY_SCOPE, INPUT_PER_REQUEST_BY_SCOPE, USER_PROMPT_TOKENS_BY_SCOPE];
  for (const figure of scopeCdfs) {
    assert.equal(figure.legend, scopeLegend, figure.name);
    assert.deepEqual(Object.keys(figure.seriesNouns), [...SCOPES], figure.name);
  }
});

test("the legend names the scope whose median is the larger and by how much, or says nothing without both", () => {
  assert.equal(medianSummary(ROWS, "longer"), "benchmark 376.6× longer");
  const reversed = ROWS.map((row) => ({ ...row, median: row.series === "SWE-Bench" ? 0.1 : row.median }));
  assert.equal(medianSummary(reversed, "more"), "human-driven 376.6× more");
  assert.equal(medianSummary(ROWS.filter((row) => row.series === "SWE-Bench"), "longer"), "");
});

// A stand-in for Plot that gives each mark as its kind, its data and the ends of a rule.
const RECORDING_PLOT = Object.freeze({
  ruleY: (data, options) => ({ mark: "rule", data, x1: options.x1, x2: options.x2 }),
  text: (data) => ({ mark: "text", data }),
});

test("the callout links the two medians and writes the note comparing them; with one scope, neither", () => {
  const marks = medianComparison(RECORDING_PLOT, ROWS, FLOOR, "longer");
  assert.deepEqual(marks.map((mark) => mark.mark), ["rule", "text"]);
  assert.deepEqual([marks[0].x1, marks[0].x2], [1, 188.3]);
  assert.deepEqual(marks[1].data, ["benchmark 376.6× longer"]);
  const benchmarkOnly = medianComparison(RECORDING_PLOT, ROWS.slice(2), FLOOR, "longer");
  assert.deepEqual(benchmarkOnly.map((mark) => mark.mark), ["text"]);
  assert.deepEqual(benchmarkOnly[0].data, []);
});
