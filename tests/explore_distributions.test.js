import assert from "node:assert/strict";
import { test } from "node:test";

import { histogramCard } from "../site/js/explore/distributions.js";
import { formatTokens } from "../site/js/shared/format.js";

const INPUT_CARD = {
  name: "input_tokens",
  title: "Input tokens per request",
  definition: "Prompt tokens of each top-level request.",
  countLabel: "Requests",
  format: formatTokens,
  logScale: true,
};

test("a card takes its bins from the bins query and its percentiles, count and maximum from the stats row", () => {
  const binRows = [
    { bin_start: 0, bin_end: 1, rows: 2 },
    { bin_start: 1024, bin_end: 2048, rows: 7 },
  ];
  const statsRow = { count: 9, max: 1900, p50: 1300, p75: 1500, p90: 1800, p95: 1850 };
  assert.deepEqual(histogramCard(INPUT_CARD, binRows, statsRow), {
    ...INPUT_CARD,
    bins: [
      { x0: 0, x1: 1, count: 2 },
      { x0: 1024, x1: 2048, count: 7 },
    ],
    percentiles: { p50: 1300, p75: 1500, p90: 1800, p95: 1850 },
    count: 9,
    max: 1900,
  });
});

test("a card with no rows has no bins and a count of 0", () => {
  const statsRow = { count: 0, max: null, p50: null, p75: null, p90: null, p95: null };
  const card = histogramCard(INPUT_CARD, [], statsRow);
  assert.deepEqual(card.bins, []);
  assert.equal(card.count, 0);
});
