import assert from "node:assert/strict";
import { test } from "node:test";

import { drawnCategories, drawnRanges, rangeTicks, rangeTipText } from "../site/js/charts/ranges.js";
import { formatSeconds } from "../site/js/shared/format.js";

// Two categories of a latency query, in milliseconds: Read's 5th percentile under the 0.1 s floor.
const ROWS = [
  { category: "Read", p5: 20, p25: 400, p50: 900, p75: 2000, p95: 30000, rows: 1200 },
  { category: "*Build/Test", p5: 1500, p25: 8000, p50: 20000, p75: 60000, p95: 400000, rows: 300 },
];
const UNIT_FACTOR = 1 / 1000; // milliseconds drawn in seconds
const FLOOR = 0.1; // seconds

test("the categories are drawn in the order every chart gives them, one row each, only those the rows hold", () => {
  const categoryColours = new Map([["Read", "a"], ["Edit", "b"], ["*Build/Test", "c"], ["Other", "d"]]);
  assert.deepEqual(drawnCategories(ROWS, categoryColours), ["Read", "*Build/Test"]);
});

test("each percentile is drawn in the drawn unit, no lower than the floor, beside the row it came from", () => {
  const [read] = drawnRanges(ROWS, UNIT_FACTOR, FLOOR);
  assert.deepEqual(
    [read.category, read.p5, read.p25, read.p50, read.p75, read.p95],
    ["Read", 0.1, 0.4, 0.9, 2, 30],
  );
  assert.equal(read.row, ROWS[0]);
});

test("the axis is ruled at the powers of ten from the lowest 5th percentile drawn to the highest 95th", () => {
  assert.deepEqual(rangeTicks(drawnRanges(ROWS, UNIT_FACTOR, FLOOR)), [0.1, 1, 10, 100]);
});

test("the tooltip names the category, its calls and each percentile, under the floor too, in the drawn unit", () => {
  const [read] = drawnRanges(ROWS, UNIT_FACTOR, FLOOR);
  assert.equal(
    rangeTipText(read, UNIT_FACTOR, formatSeconds),
    "Read\n1,200 calls\n5th: 0.02 s\n25th: 0.4 s\nmedian: 0.9 s\n75th: 2.0 s\n95th: 30.0 s",
  );
});
