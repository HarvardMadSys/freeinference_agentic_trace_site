import assert from "node:assert/strict";
import { test } from "node:test";

import { formatSeconds, formatTokens } from "../site/js/shared/format.js";
import {
  binsFromRows, cardTicks, drawableBins, maximumText, percentileEntries, rowsText,
} from "../site/js/shared/histogram.js";

const TOKENS_CARD = {
  title: "Input tokens per request",
  definition: "Prompt tokens of each request, in the selected weeks and harnesses.",
  bins: [],
  percentiles: { p50: 129087, p75: 260000, p90: 512300, p95: 801000 },
  count: 1186582,
  max: 2000000,
  logScale: true,
  format: formatTokens,
  countLabel: "Requests",
};

test("the legend gives each percentile and the maximum in the card's format", () => {
  assert.deepEqual(percentileEntries(TOKENS_CARD).map((entry) => entry.text), [
    "p50 129.1k", "p75 260k", "p90 512.3k", "p95 801k",
  ]);
  assert.equal(maximumText(TOKENS_CARD), "max 2M");
});

test("a duration card's legend writes its values as durations", () => {
  const durationCard = { ...TOKENS_CARD, percentiles: { p50: 724, p75: 1800, p90: 3780, p95: 5400 }, max: 42.5,
    format: formatSeconds };
  assert.equal(percentileEntries(durationCard)[0].text, "p50 12.1 min");
  assert.equal(maximumText(durationCard), "max 42.5 s");
});

test("a card with no rows has an empty legend, and its line of rows says 0", () => {
  const emptyCard = { ...TOKENS_CARD, percentiles: { p50: null, p75: null, p90: null, p95: null }, count: 0, max: null };
  assert.deepEqual(percentileEntries(emptyCard), []);
  assert.equal(maximumText(emptyCard), "");
  assert.equal(rowsText(emptyCard), "0 requests");
});

test("the line of rows counts the card's rows in its own noun", () => {
  assert.equal(rowsText(TOKENS_CARD), "1,186,582 requests");
});

test("a log card ticks its powers of ten over its bins, or its own ticks; a linear card leaves them to Plot", () => {
  const bins = [{ x0: 1, x1: 10, count: 5 }, { x0: 10, x1: 1000, count: 3 }];
  assert.deepEqual(cardTicks({ ...TOKENS_CARD, bins }), [1, 10, 100, 1000]);
  assert.deepEqual(cardTicks({ ...TOKENS_CARD, bins, ticks: () => [1, 3, 10] }), [1, 3, 10]);
  assert.equal(cardTicks({ ...TOKENS_CARD, bins, logScale: false }), undefined);
});

test("bins keep the rows' order and become numbers", () => {
  const rows = [
    { bin_start: 2048, bin_end: 4096, rows: 7n },
    { bin_start: 1024, bin_end: 2048, rows: 1532n },
  ];
  assert.deepEqual(binsFromRows(rows), [
    { x0: 2048, x1: 4096, count: 7 },
    { x0: 1024, x1: 2048, count: 1532 },
  ]);
});

test("no rows give no bins", () => {
  assert.deepEqual(binsFromRows([]), []);
});

test("a log card draws only the bins that start above 0, a linear card every bin", () => {
  const bins = [
    { x0: 0, x1: 1, count: 5 },
    { x0: 2, x1: 4, count: 1 },
  ];
  assert.deepEqual(drawableBins({ ...TOKENS_CARD, bins, logScale: true }), [{ x0: 2, x1: 4, count: 1 }]);
  assert.deepEqual(drawableBins({ ...TOKENS_CARD, bins, logScale: false }), bins);
});
