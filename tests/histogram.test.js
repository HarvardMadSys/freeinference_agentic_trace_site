import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSeconds, formatTokens } from "../site/js/shared/format.js";
import { binsFromRows, subtitle } from "../site/js/shared/histogram.js";

const TOKENS_CARD = {
  title: "Input tokens per request",
  definition: "Prompt tokens of each request, in the selected weeks and scope.",
  bins: [],
  percentiles: { p50: 129087, p75: 260000, p90: 512300, p95: 801000 },
  count: 1186582,
  max: 2000000,
  logScale: true,
  format: formatTokens,
};

test("the subtitle gives n, the median, the 90th percentile and the maximum in the card's format", () => {
  assert.equal(subtitle(TOKENS_CARD), "n = 1,186,582 · p50 129.1k · p90 512.3k · max 2M");
});

test("the subtitle of a duration card formats its values as durations", () => {
  const durationCard = {
    ...TOKENS_CARD,
    percentiles: { p50: 724, p75: 1800, p90: 3780, p95: 5400 },
    count: 5321,
    max: 42.5,
    format: formatSeconds,
  };
  assert.equal(subtitle(durationCard), "n = 5,321 · p50 12m 04s · p90 1h 03m · max 42.5s");
});

test("the subtitle of a card with no rows is just n = 0", () => {
  const emptyCard = { ...TOKENS_CARD, percentiles: { p50: null, p75: null, p90: null, p95: null }, count: 0, max: null };
  assert.equal(subtitle(emptyCard), "n = 0");
});

test("bins keep the rows' order and become numbers", () => {
  const rows = [
    { bin_start: 2048, bin_end: 4096, requests: 7n },
    { bin_start: 1024, bin_end: 2048, requests: 1532n },
  ];
  assert.deepEqual(binsFromRows(rows), [
    { x0: 2048, x1: 4096, count: 7 },
    { x0: 1024, x1: 2048, count: 1532 },
  ]);
});

test("no rows give no bins", () => {
  assert.deepEqual(binsFromRows([]), []);
});
