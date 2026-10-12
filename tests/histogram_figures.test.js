import assert from "node:assert/strict";
import { test } from "node:test";

import { subagentTicks } from "../site/js/figures/sessions.js";
import { formatTokens } from "../site/js/shared/format.js";
import { histogramCard } from "../site/js/shared/histogram.js";

// A histogram figure's entry, as a section module lists it.
const INPUT_CARD = {
  name: "input_tokens",
  title: "Input tokens per request",
  definition: "Prompt tokens of each top-level request.",
  query: "explore/input_tokens_bins",
  statsQuery: "explore/input_tokens_stats",
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

test("the subagents axis ticks within its bins' range, every other tick on a narrow chart", () => {
  assert.deepEqual(subagentTicks([1, 41], 6), [1, 3, 10, 30]);
  assert.deepEqual(subagentTicks([1, 12], 6), [1, 3, 10]);
  assert.deepEqual(subagentTicks([1, 41], 3), [1, 10]);
});
