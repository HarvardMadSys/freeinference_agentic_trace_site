import assert from "node:assert/strict";
import { test } from "node:test";

import { rankedLegend, rankTips, stackedSharePoints } from "../site/js/charts/ranked.js";

// Two rank bins of a cost share query, the first of 55 sessions, the second of 54, of 109 sessions ranked.
const BIN_ROWS = [
  { percentile: 25, cached: 0.5, uncached: 0.25, output: 0.25, bin_sessions: 55, ranked_bin: "ranked sessions", rows: 109 },
  { percentile: 75, cached: 0.75, uncached: 0.125, output: 0.125, bin_sessions: 54, ranked_bin: "ranked sessions", rows: 109 },
];
const PARTS = { cached: "Cached input", uncached: "Uncached input", output: "Output" };

test("a stacked area has one point per part and bin, part by part, in the parts' order", () => {
  assert.deepEqual(stackedSharePoints(BIN_ROWS, ["output", "cached"]), [
    { part: "output", percentile: 25, share: 0.25 },
    { part: "output", percentile: 75, share: 0.125 },
    { part: "cached", percentile: 25, share: 0.5 },
    { part: "cached", percentile: 75, share: 0.75 },
  ]);
});

test("a hidden part has no points", () => {
  assert.deepEqual(stackedSharePoints(BIN_ROWS, []), []);
});

test("a bin's tooltip points at the top of the shown parts and names each with its share and the bin's sessions", () => {
  const [first] = rankTips(BIN_ROWS, ["cached", "output"], PARTS);
  assert.equal(first.percentile, 25);
  assert.equal(first.top, 0.75);
  assert.equal(first.text, "Percentile 25.0\nCached input: 50.0%\nOutput: 25.0%\n55 sessions");
});

test("the legend lists every part bottom up in the stack, each in its colour, whichever parts the rows hold", () => {
  const colours = new Map([["cached", "blue"], ["uncached", "orange"], ["output", "green"]]);
  const legend = rankedLegend([], colours, { parts: PARTS });
  assert.deepEqual(legend.series, [
    { name: "cached", label: "Cached input" }, { name: "uncached", label: "Uncached input" },
    { name: "output", label: "Output" },
  ]);
  assert.equal(legend.colours, colours);
});
