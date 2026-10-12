import assert from "node:assert/strict";
import { test } from "node:test";

import { drawnProviderRows, idleGapEdgeSeconds, idleGapLegend } from "../site/js/figures/caching.js";
import {
  causeLegend, gapBinColours, gapBinLegend, meanHitRatioBars, transitionLegend,
} from "../site/js/figures/caching_gaps.js";
import {
  decadeTicks, multipleText, prefillPoints, retainedDomain, scopeLegend, ttlLabel,
} from "../site/js/figures/caching_retention.js";
import { assignColours, causeColours, OTHER_SERIES } from "../site/js/theme/colours.js";

// The colours every figure shares, as the page gives a legend function: the providers in their fixed order.
const FIGURE_COLOURS = Object.freeze({
  models: new Map(),
  categories: new Map(),
  providers: new Map([["B", "var(--series-1)"], ["A", "var(--series-2)"], ["C", "var(--series-3)"]]),
});

test("the idle-gap edges run geometrically from 10 s to one hour in 26 bins, as the pipeline's do", () => {
  assert.equal(idleGapEdgeSeconds(0), 10);
  assert.ok(Math.abs(idleGapEdgeSeconds(26) - 3600) < 1e-9);
  // each bin is 1.25 times as wide as the one before: 360 ** (1 / 26)
  assert.ok(Math.abs(idleGapEdgeSeconds(1) / idleGapEdgeSeconds(0) - 360 ** (1 / 26)) < 1e-12);
  assert.ok(Math.abs(idleGapEdgeSeconds(0.5) - Math.sqrt(idleGapEdgeSeconds(0) * idleGapEdgeSeconds(1))) < 1e-9);
});

test("the gap bins take the six gap-bin colours, shortest gap first, whichever bins the rows hold", () => {
  const colours = gapBinColours();
  assert.deepEqual([...colours.keys()], ["<1m", "1–5m", "5–15m", "15–30m", "30m–1h", ">1h"]);
  assert.deepEqual([...colours.values()], [1, 2, 3, 4, 5, 6].map((slot) => `var(--gap-bin-${slot})`));
  const legend = gapBinLegend([{ series: ">1h" }, { series: "<1m" }], FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "<1m", label: "<1m" }, { name: ">1h", label: ">1h" }]);
  assert.equal(legend.colours.get(">1h"), "var(--gap-bin-6)");
});

test("the cause legend names the causes as the paper does, in its order, each in its cause colour", () => {
  const legend = causeLegend([{ series: "user" }, { series: "tool" }], FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "tool", label: "Tool Gap" }, { name: "user", label: "User Idle" }]);
  assert.equal(legend.colours.get("user"), "var(--cause-user)");
  assert.deepEqual([...causeColours().keys()], ["tool", "ask_user_tool", "user", "subagent"]);
});

test("the mean-hit-ratio bars come in the paper's order, a mean below the axis ending at its low end", () => {
  const bars = meanHitRatioBars([
    { waited_for: "user", rows: 60, mean_hit_ratio: 0.5 },
    { waited_for: "tool", rows: 900, mean_hit_ratio: 0.97 },
  ]);
  assert.deepEqual(bars, [
    { cause: "tool", name: "Tool Gap", end: 0.97, mean: 0.97, rows: 900 },
    { cause: "user", name: "User Idle", end: 0.7, mean: 0.5, rows: 60 },
  ]);
});

test("the transition legend lists appends, then mutations, each in its transition colour", () => {
  const legend = transitionLegend([{ series: "mutation" }, { series: "append" }], FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "append", label: "Append" }, { name: "mutation", label: "Mutation" }]);
  assert.equal(legend.colours.get("append"), "var(--transition-append)");
  assert.equal(legend.colours.get("mutation"), "var(--transition-mutation)");
});

test("a provider keeps its colour from the provider order whichever providers the rows hold", () => {
  const legend = idleGapLegend([{ provider: "C" }, { provider: "A" }], FIGURE_COLOURS, "provider");
  assert.deepEqual(legend.series, [{ name: "A", label: "Provider A" }, { name: "C", label: "Provider C" }]);
  assert.equal(legend.colours.get("A"), "var(--series-2)");
  assert.equal(legend.colours.get("C"), "var(--series-3)");
});

test("the idle-gap figure lists and draws only the eight providers with most requests, none in the Other grey", () => {
  const providers = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];
  const colours = { ...FIGURE_COLOURS, providers: assignColours(providers) };
  const rows = providers.map((provider) => ({ provider, idle_gap_bin: 0 }));
  const legend = idleGapLegend(rows, colours, "provider");
  assert.deepEqual(legend.series.map((one) => one.name), providers.slice(0, 8));
  for (const { name } of legend.series) {
    assert.notEqual(legend.colours.get(name), OTHER_SERIES, name);
  }
  assert.deepEqual(drawnProviderRows(rows, colours).map((row) => row.provider), providers.slice(0, 8));
});

// Rows of the prefill query: two TTLs of the paper's harnesses and three of the benchmark replay, in the query's order.
const PREFILL_ROWS = [
  { scope: "Agentic", ttl: "1m", normalised_prefill: 6.2, mean_retained_tokens: 415_000, rows: 900 },
  { scope: "Agentic", ttl: "none", normalised_prefill: 1, mean_retained_tokens: 102_000_000, rows: 900 },
  { scope: "SWE-Bench", ttl: "1s", normalised_prefill: 17.4, mean_retained_tokens: 3_900, rows: 60 },
  { scope: "SWE-Bench", ttl: "10s", normalised_prefill: 3.2, mean_retained_tokens: 7_300, rows: 60 },
  { scope: "SWE-Bench", ttl: "15m", normalised_prefill: 1.02, mean_retained_tokens: 42_000, rows: 60 },
];

test("a prefill point per row, in the query's order, its TTL named, and placed where the paper labels one", () => {
  assert.deepEqual(prefillPoints(PREFILL_ROWS), [
    { scope: "Agentic", ttl: "1m", label: "1m", retained: 415_000, prefill: 6.2, placement: "right" },
    { scope: "Agentic", ttl: "none", label: "∞", retained: 102_000_000, prefill: 1, placement: "right" },
    { scope: "SWE-Bench", ttl: "1s", label: "1s", retained: 3_900, prefill: 17.4, placement: "right" },
    { scope: "SWE-Bench", ttl: "10s", label: "10s", retained: 7_300, prefill: 3.2, placement: "left" },
    { scope: "SWE-Bench", ttl: "15m", label: "15m", retained: 42_000, prefill: 1.02, placement: null },
  ]);
  assert.equal(ttlLabel("1d"), "1d");
});

test("the retained-tokens axis runs from half the fewest to three times the most, ticked at powers of ten", () => {
  const domain = retainedDomain(prefillPoints(PREFILL_ROWS));
  assert.deepEqual(domain, [1_950, 306_000_000]);
  assert.deepEqual(decadeTicks(domain), [1e4, 1e5, 1e6, 1e7, 1e8]);
  assert.deepEqual(decadeTicks([1, 100]), [1, 10, 100]);
  assert.equal(multipleText(2), "2×");
});

test("the scope legend lists the paper's harnesses as human-driven, then the benchmark, each in its colour", () => {
  const legend = scopeLegend([{ scope: "SWE-Bench" }, { scope: "Agentic" }], FIGURE_COLOURS, "scope");
  assert.deepEqual(legend.series, [
    { name: "Agentic", label: "Human-driven" }, { name: "SWE-Bench", label: "Benchmark" },
  ]);
  assert.equal(legend.colours.get("Agentic"), "var(--series-1)");
  assert.equal(legend.colours.get("SWE-Bench"), "var(--series-8)");
});
