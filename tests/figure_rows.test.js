import assert from "node:assert/strict";
import { test } from "node:test";

import { cdfSeries, dropThinGroups, hiddenText, restingRowCount } from "../site/js/figures/figure_rows.js";

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

test("the hidden note names what was hidden, in the singular or the plural", () => {
  assert.equal(hiddenText(0, "bin_start"), "");
  assert.equal(hiddenText(1, "bin_start"), "1 bin hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(3, "bin_start"), "3 bins hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(2, "series"), "2 series hidden (fewer than 50 rows each)");
  assert.equal(hiddenText(1, "week"), "1 week hidden (fewer than 50 rows each)");
});

test("CDF rows become series in the labels' order, under their labels, with a missing series left out", () => {
  const labels = { tool_steps: "Tool steps", user_steps: "User steps", requests: "Requests" };
  assert.deepEqual(cdfSeries(CDF_ROWS, labels), [
    { name: "Tool steps", points: [{ x: 0, share: 0 }, { x: 12, share: 1 }] },
    { name: "Requests", points: [{ x: 3, share: 0 }, { x: 40, share: 1 }] },
  ]);
});

test("a CDF value below the floor is drawn at the floor", () => {
  const [toolSteps] = cdfSeries(CDF_ROWS, { tool_steps: "Tool steps" }, 1);
  assert.deepEqual(toolSteps.points, [{ x: 1, share: 0 }, { x: 12, share: 1 }]);
});
