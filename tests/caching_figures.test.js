import assert from "node:assert/strict";
import { test } from "node:test";

import { FIGURES, idleGapEdgeSeconds, idleGapLegend } from "../site/js/figures/caching.js";
import { GAP_FIGURES, meanHitRatioBars, mutationTableLines } from "../site/js/figures/caching_gaps.js";
import { gapBinColours, HIT_RATIO_CDF_BY_GAP_BIN } from "../site/js/figures/caching_cdfs.js";
import {
  API_COST_BY_TTL, costColours, INFRASTRUCTURE_COST_BY_TTL, kneeText, lowestText,
} from "../site/js/simulation/costs.js";
import { prefillPoints, retainedDomain } from "../site/js/simulation/prefill.js";
import { scopeLegend } from "../site/js/comparison/scopes.js";
import { decadeTicks } from "../site/js/axes/ticks.js";
import { assignColours, OTHER_SERIES } from "../site/js/theme/colours.js";

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
  const legend = HIT_RATIO_CDF_BY_GAP_BIN.legend([{ series: ">1h" }, { series: "<1m" }], FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "<1m", label: "Under 1 min" }, { name: ">1h", label: "Over 1 h" }]);
  assert.equal(legend.colours.get(">1h"), "var(--gap-bin-6)");
});

test("the cause legend names the causes as the paper does, in its order, each in its cause colour", () => {
  const legend = GAP_FIGURES.gapByCause.legend([{ series: "user" }, { series: "tool" }], FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "tool", label: "Tool wait" }, { name: "user", label: "User idle" }]);
  assert.equal(legend.colours.get("user"), "var(--cause-user)");
});

test("the mean-hit-ratio bars come in the paper's order, each with its mean", () => {
  const bars = meanHitRatioBars([
    { waited_for: "user", rows: 60, mean_hit_ratio: 0.5 },
    { waited_for: "tool", rows: 900, mean_hit_ratio: 0.97 },
  ]);
  assert.deepEqual(bars, [
    { cause: "tool", name: "Tool wait", mean: 0.97, rows: 900 },
    { cause: "user", name: "User idle", mean: 0.5, rows: 60 },
  ]);
});

test("the transition legend lists appends, then mutations, each in its transition colour", () => {
  const rows = [{ series: "mutation" }, { series: "append" }];
  const legend = GAP_FIGURES.hitRatioByTransition.legend(rows, FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series, [{ name: "append", label: "Append" }, { name: "mutation", label: "Mutation" }]);
  assert.equal(legend.colours.get("append"), "var(--transition-append)");
  assert.equal(legend.colours.get("mutation"), "var(--transition-mutation)");
});

test("a provider keeps its colour from the provider order whichever providers the rows hold, listed by letter", () => {
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
  const idleGapFigure = FIGURES.find((figure) => figure.name === "hit_ratio_by_idle_gap");
  assert.deepEqual(idleGapFigure.drawnRows(rows, colours).map((row) => row.provider), providers.slice(0, 8));
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
    { scope: "Agentic", ttl: "1m", label: "1 min", retained: 415_000, prefill: 6.2, placement: "right" },
    { scope: "Agentic", ttl: "none", label: "∞", retained: 102_000_000, prefill: 1, placement: "right" },
    { scope: "SWE-Bench", ttl: "1s", label: "1 s", retained: 3_900, prefill: 17.4, placement: "below" },
    { scope: "SWE-Bench", ttl: "10s", label: "10 s", retained: 7_300, prefill: 3.2, placement: "below" },
    { scope: "SWE-Bench", ttl: "15m", label: "15 min", retained: 42_000, prefill: 1.02, placement: null },
  ]);
});

test("the retained-tokens axis runs from half the fewest to three times the most, ticked at powers of ten", () => {
  const domain = retainedDomain(prefillPoints(PREFILL_ROWS));
  assert.deepEqual(domain, [1_950, 306_000_000]);
  assert.deepEqual(decadeTicks(domain), [1e4, 1e5, 1e6, 1e7, 1e8]);
  assert.deepEqual(decadeTicks([1, 100]), [1, 10, 100]);
});

test("the scope legend lists the paper's harnesses as human-driven, then the benchmark, each in its colour", () => {
  const legend = scopeLegend([{ scope: "SWE-Bench" }, { scope: "Agentic" }], FIGURE_COLOURS, "scope");
  assert.deepEqual(legend.series, [
    { name: "Agentic", label: "Human-driven" }, { name: "SWE-Bench", label: "Benchmark" },
  ]);
  assert.equal(legend.colours.get("Agentic"), "var(--series-1)");
  assert.equal(legend.colours.get("SWE-Bench"), "var(--series-8)");
});

// Rows of the API cost query at two TTLs, by part, then in TTL order, as the query gives them; the knee at 30m.
const MINUTE = { ttl: "1m", ttl_seconds: 60, total_multiple: 1, is_knee: false, rows: 90 };
const HALF_HOUR = { ttl: "30m", ttl_seconds: 1800, total_multiple: 0.65, is_knee: true, rows: 90 };
const API_ROWS = [
  { ...MINUTE, part: "cache_read", cost_multiple: 0.1 },
  { ...HALF_HOUR, part: "cache_read", cost_multiple: 0.15 },
  { ...MINUTE, part: "input", cost_multiple: 0.5 },
  { ...HALF_HOUR, part: "input", cost_multiple: 0.1 },
  { ...MINUTE, part: "output", cost_multiple: 0.4 },
  { ...HALF_HOUR, part: "output", cost_multiple: 0.4 },
];

test("a cost figure's legend lists its parts, each in the colour of what it prices", () => {
  const colours = costColours(["output", "cache_read", "input"]);
  assert.deepEqual([...colours.keys()], ["output", "cache_read", "input"]);
  assert.equal(colours.get("cache_read"), "var(--token-cached)");
  assert.equal(colours.get("input"), "var(--token-uncached)");
  const infrastructure = INFRASTRUCTURE_COST_BY_TTL.legend([{ part: "storage" }], {}, "part");
  assert.deepEqual(infrastructure.series, [{ name: "storage", label: "Storage" }]);
  assert.equal(infrastructure.colours.get("recompute"), "var(--token-uncached)");
  assert.equal(infrastructure.colours.get("storage"), "var(--series-7)");
});

test("each cost figure's callout names the TTL it marks and its total, on two lines", () => {
  assert.equal(kneeText("0.65×", "30 min"), "0.65× at 30 min,\nnear the lowest");
  assert.equal(lowestText("0.42×", "15 min"), "Lowest 0.42×\nat 15 min");
});

test("the mutation table's lines come in the paper's order, causes after transitions, shares with one decimal", () => {
  const rows = [
    { table_row: "compaction", steps_share: 0.000416, sessions_share: 0.0368, prefill_share: 0.0056, rows: 900 },
    { table_row: "append", steps_share: 0.96, sessions_share: 0.4359, prefill_share: 0.3752, rows: 900 },
    { table_row: "mutation", steps_share: 0.04, sessions_share: 0.5641, prefill_share: null, rows: 900 },
  ];
  assert.deepEqual(mutationTableLines(rows), [
    { name: "append", isCause: false, cells: ["Append", "96.0%", "43.6%", "37.5%"] },
    { name: "mutation", isCause: false, cells: ["Mutation", "4.0%", "56.4%", "—"] },
    { name: "compaction", isCause: true, cells: ["Compaction", "<0.1%", "3.7%", "0.6%"] },
  ]);
});

test("the API cost's legend lists every part its stack draws, the output included", () => {
  const legend = API_COST_BY_TTL.legend(API_ROWS, {}, "part");
  const drawn = [...new Set(API_ROWS.map((row) => row.part))].sort();
  assert.deepEqual(legend.series.map((one) => one.name).sort(), drawn);
  assert.deepEqual(legend.series.map((one) => one.label), ["Cached input", "Uncached input", "Output"]);
  assert.equal(legend.colours.get("output"), "var(--token-output)");
});
