import assert from "node:assert/strict";
import { test } from "node:test";

import { growthPoints } from "../site/js/figures/tokens.js";

// Rows of the token growth query: two message bins, the second with no uncached median.
const ROWS = [
  { bin_start: 1, rows: 900, median_cached_tokens: 0, median_uncached_tokens: 12_000, median_output_tokens: 300 },
  { bin_start: 2, rows: 400, median_cached_tokens: 15_000, median_uncached_tokens: null, median_output_tokens: 250 },
];

test("the token growth draws a point per bin of each shown part with a median, and none of a hidden part", () => {
  const points = growthPoints(ROWS, ["cached", "uncached", "output"]);
  assert.deepEqual(points.map((point) => [point.part, point.messages]), [
    ["cached", 1], ["cached", 2], ["uncached", 1], ["output", 1], ["output", 2],
  ]);
  const withoutCached = growthPoints(ROWS, ["uncached", "output"]);
  assert.ok(withoutCached.every((point) => point.part !== "cached"));
  assert.equal(points[0].tokens, 1, "a median of zero is drawn at one token, on the log axis");
});
