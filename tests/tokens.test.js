import assert from "node:assert/strict";
import { test } from "node:test";

import { growthPoints, inputSizeTicks } from "../site/js/figures/tokens.js";

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

test("the input-size axis writes its bins' starts in binary thousands, on at most five evenly spaced bins", () => {
  const bins = [1024, 2048, 4096, 8192, 16384, 32768, 65536];
  const format = inputSizeTicks(bins.map((binStart) => ({ bin_start: binStart, role: "system", share: 1 })));
  assert.deepEqual(bins.map(format), ["1k", "", "4k", "", "16k", "", "64k"]);
});
