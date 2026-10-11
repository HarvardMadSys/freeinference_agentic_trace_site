import assert from "node:assert/strict";
import { test } from "node:test";

import { idleGapEdgeSeconds, idleGapLegend, retainedLegend, retainedPoints } from "../site/js/figures/caching.js";
import {
  causeLegend, gapBinColours, gapBinLegend, meanHitRatioBars, transitionLegend,
} from "../site/js/figures/caching_gaps.js";
import { causeColours } from "../site/js/theme/colours.js";

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

test("the retained points are each shown series' value per TTL, in TTL order, reusable first", () => {
  const rows = [
    { ttl: "1h", reusable_over_active: 0.15, dead_over_active: 0.1, rows: 8 },
    { ttl: "5m", reusable_over_active: 0.05, dead_over_active: null, rows: 8 },
  ];
  assert.deepEqual(retainedPoints(rows, new Set()), [
    { series: "reusable", ttl: "5m", value: 0.05 },
    { series: "reusable", ttl: "1h", value: 0.15 },
    { series: "dead", ttl: "1h", value: 0.1 },
  ]);
  assert.deepEqual(retainedPoints(rows, new Set(["reusable"])), [{ series: "dead", ttl: "1h", value: 0.1 }]);
});

test("the retained legend lists reusable in blue and dead in red", () => {
  const legend = retainedLegend();
  assert.deepEqual(legend.series, [{ name: "reusable", label: "Reusable" }, { name: "dead", label: "Dead" }]);
  assert.deepEqual([...legend.colours.values()], ["var(--series-1)", "var(--series-8)"]);
});

test("a provider keeps its colour from the provider order whichever providers the rows hold", () => {
  const legend = idleGapLegend([{ provider: "C" }, { provider: "A" }], FIGURE_COLOURS, "provider");
  assert.deepEqual(legend.series, [{ name: "A", label: "Provider A" }, { name: "C", label: "Provider C" }]);
  assert.equal(legend.colours.get("A"), "var(--series-2)");
  assert.equal(legend.colours.get("C"), "var(--series-3)");
});
