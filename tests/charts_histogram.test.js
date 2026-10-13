import assert from "node:assert/strict";
import { test } from "node:test";

import { subagentTicks } from "../site/js/figures/sessions.js";
import { formatCompactCount, formatSeconds, formatWholeCount } from "../site/js/shared/format.js";
import {
  binsFromRows, cardTicks, countAxis, drawableBins, histogramCard, rowsText, summaryText,
} from "../site/js/charts/histogram.js";

// A card of token counts on a log axis, drawn but for its bins.
const TOKENS_CARD = {
  title: "Tokens per request",
  definition: "Tokens of each request.",
  bins: [],
  percentiles: { p50: 129087, p95: 801000 },
  count: 1186582,
  max: 2000000,
  logScale: true,
  valueFormat: formatCompactCount,
  countLabel: "Requests",
};

test("the summary gives the median and the 95th percentile in the card's format, and the maximum where asked", () => {
  assert.equal(summaryText(TOKENS_CARD), "median 129.1k · p95 801.0k");
  assert.equal(summaryText({ ...TOKENS_CARD, showsMaximum: true }), "median 129.1k · p95 801.0k · max 2.0M");
});

test("a duration card's summary writes its values as durations", () => {
  const durationCard = { ...TOKENS_CARD, percentiles: { p50: 724, p95: 5400 }, max: 42.5,
    valueFormat: formatSeconds };
  assert.equal(summaryText(durationCard), "median 12.1 min · p95 90.0 min");
});

test("a card with no rows has an empty summary, and its line of rows says 0", () => {
  const emptyCard = { ...TOKENS_CARD, percentiles: { p50: null, p95: null }, count: 0, max: null };
  assert.equal(summaryText(emptyCard), "");
  assert.equal(rowsText(emptyCard), "0 requests");
});

test("a card of counts over many powers of ten draws them on a log axis from a power of ten, else on a linear one from 0", () => {
  const bins = [{ x0: 0, x1: 0.5, count: 700 }, { x0: 0.5, x1: 1, count: 986922 }];
  assert.deepEqual(countAxis({ ...TOKENS_CARD, bins, logScale: false, logCounts: true }), {
    type: "log", domain: [100, 1e6], base: 100, ticks: [100, 1000, 10000, 100000, 1e6],
  });
  assert.equal(countAxis({ ...TOKENS_CARD, bins }).type, "linear");
});

test("the line of rows counts the card's rows in its own noun", () => {
  assert.equal(rowsText(TOKENS_CARD), "1,186,582 requests");
});

test("a log card ticks its powers of ten over its bins, or its own ticks; a linear card leaves them to Plot", () => {
  const bins = [{ x0: 1, x1: 10, count: 5 }, { x0: 10, x1: 1000, count: 3 }];
  assert.deepEqual(cardTicks({ ...TOKENS_CARD, bins }), [1, 10, 100, 1000]);
  assert.deepEqual(cardTicks({ ...TOKENS_CARD, bins, ticks: () => [1, 3, 10] }), [1, 3, 10]);
  const wide = [{ x0: 1, x1: 10, count: 5 }, { x0: 10, x1: 1e6, count: 3 }];
  assert.deepEqual(cardTicks({ ...TOKENS_CARD, bins: wide }, 3), [1, 1e3, 1e6]);
  assert.equal(cardTicks({ ...TOKENS_CARD, bins, logScale: false }), undefined);
});

test("bins keep the rows' order", () => {
  const rows = [
    { bin_start: 2048, bin_end: 4096, rows: 7 },
    { bin_start: 1024, bin_end: 2048, rows: 1532 },
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

// The subagents histogram's parameters, as its figure entry gives them.
const SUBAGENTS_PARAMETERS = {
  statsQuery: "explore/subagents_per_session_stats",
  countLabel: "Sessions",
  xLabel: "Subagents",
  valueFormat: formatWholeCount,
  xTickFormat: formatWholeCount,
  logScale: true,
  logCounts: false,
  showsMaximum: true,
  ticks: subagentTicks,
};

test("a card takes its parameters, its bins from the bins query and its percentiles, count and maximum from the stats row", () => {
  const binRows = [
    { bin_start: 0, bin_end: 1, rows: 5 },
    { bin_start: 2, bin_end: 4, rows: 1 },
  ];
  const statsRow = { count: 6, max: 3, p50: 0, p75: 0, p90: 1.5, p95: 2.25 };
  assert.deepEqual(histogramCard(SUBAGENTS_PARAMETERS, binRows, statsRow), {
    ...SUBAGENTS_PARAMETERS,
    bins: [
      { x0: 0, x1: 1, count: 5 },
      { x0: 2, x1: 4, count: 1 },
    ],
    percentiles: { p50: 0, p95: 2.25 },
    count: 6,
    max: 3,
  });
});

test("a card with no rows has no bins and a count of 0", () => {
  const statsRow = { count: 0, max: null, p50: null, p75: null, p90: null, p95: null };
  const card = histogramCard(SUBAGENTS_PARAMETERS, [], statsRow);
  assert.deepEqual(card.bins, []);
  assert.equal(card.count, 0);
  assert.equal(rowsText(card), "0 sessions");
});
