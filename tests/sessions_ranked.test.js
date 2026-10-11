import assert from "node:assert/strict";
import { test } from "node:test";

import {
  COST_SHARE_BY_SESSION,
  partsLegend,
  rankTips,
  SESSION_TIME_BY_PART,
  stackedSharePoints,
} from "../site/js/figures/sessions_ranked.js";
import { REQUEST_PART_COLOURS, waitColours } from "../site/js/session_charts/timeline_bars.js";
import { TOKEN_PART_COLOURS } from "../site/js/shared/charts.js";

// Two rank bins of a cost share query, the first of 55 sessions, the second of 54.
const BIN_ROWS = [
  { percentile: 25, cached: 0.5, uncached: 0.25, output: 0.25, rows: 55 },
  { percentile: 75, cached: 0.75, uncached: 0.125, output: 0.125, rows: 54 },
];
const LABELS = { cached: "Cached input", uncached: "Uncached input", output: "Output" };

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
  const [first] = rankTips(BIN_ROWS, ["cached", "output"], LABELS);
  assert.equal(first.percentile, 25);
  assert.equal(first.top, 0.75);
  assert.equal(first.text, "Percentile 25.0\nCached input: 50.0%\nOutput: 25.0%\n55 sessions");
});

test("a legend of parts lists each part with its label, in order, with the colours given", () => {
  const colours = new Map([["cached", "green"], ["uncached", "orange"], ["output", "blue"]]);
  const legend = partsLegend(LABELS, colours);
  assert.deepEqual(legend.series, [
    { name: "cached", label: "Cached input" },
    { name: "uncached", label: "Uncached input" },
    { name: "output", label: "Output" },
  ]);
  assert.equal(legend.colours, colours);
});

test("the session time's legend draws model time in a request's ink and waits in the Timeline's wait colours", () => {
  const legend = SESSION_TIME_BY_PART.legend();
  assert.deepEqual(legend.series.map((one) => one.name), ["model", "tool", "human"]);
  assert.equal(legend.colours.get("model"), REQUEST_PART_COLOURS.whole);
  assert.equal(legend.colours.get("tool"), waitColours().get("tool"));
  assert.equal(legend.colours.get("human"), waitColours().get("user"));
});

test("the cost share's legend draws each token part in its token colour", () => {
  const legend = COST_SHARE_BY_SESSION.legend();
  assert.deepEqual(legend.series.map((one) => one.name), ["cached", "uncached", "output"]);
  assert.deepEqual([...legend.colours], Object.entries(TOKEN_PART_COLOURS));
});
