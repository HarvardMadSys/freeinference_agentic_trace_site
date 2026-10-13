import assert from "node:assert/strict";
import { test } from "node:test";

import { axisTtls, calloutPoint, costStacks, kneeLinesLegend } from "../site/js/charts/knee_lines.js";

// Rows of an API cost query at two TTLs, by part, then in TTL order, as the query gives them; the knee at 30m.
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
// The parts bottom up in the stack, with their labels.
const PARTS = { output: "Output", cache_read: "Cached input", input: "Uncached input" };

// A callout's text as a figure writes it, from the TTL's total and name.
function describe(total, ttl) {
  return `${total} at ${ttl}`;
}

test("a stack per TTL tops at the sum of its shown parts, its tooltip reading down from the top", () => {
  const stacks = costStacks(API_ROWS, PARTS);
  assert.deepEqual(stacks.map((stack) => [stack.ttl, stack.seconds]), [["1m", 60], ["30m", 1800]]);
  assert.ok(Math.abs(stacks[1].top - 0.65) < 1e-12);
  assert.equal(stacks[1].text, "TTL 30 min\nUncached input 0.10×\nCached input 0.15×\nOutput 0.40×\nTotal 0.65×");
  const outputHidden = costStacks(API_ROWS.filter((row) => row.part !== "output"), PARTS);
  assert.ok(Math.abs(outputHidden[1].top - 0.25) < 1e-12);
  assert.equal(outputHidden[1].text, "TTL 30 min\nUncached input 0.10×\nCached input 0.15×\nTotal 0.65×");
});

test("the callout sits on the marked TTL's stack with the figure's text, or is absent when none is marked", () => {
  const stacks = costStacks(API_ROWS, PARTS);
  const callout = calloutPoint(API_ROWS, stacks, "is_knee", describe);
  assert.equal(callout.seconds, 1800);
  assert.ok(Math.abs(callout.top - 0.65) < 1e-12);
  assert.equal(callout.text, "0.65× at 30 min");
  const unmarked = API_ROWS.map((row) => ({ ...row, is_knee: false }));
  assert.equal(calloutPoint(unmarked, stacks, "is_knee", describe), null);
});

test("the axis names the TTLs of a second, a minute, an hour and a day that the stacks draw", () => {
  const stacks = [
    { ttl: "1s", seconds: 1 }, { ttl: "10s", seconds: 10 }, { ttl: "1m", seconds: 60 }, { ttl: "1d", seconds: 86400 },
  ];
  assert.deepEqual([...axisTtls(stacks)], [[1, "1 s"], [60, "1 min"], [86400, "1 d"]]);
});

test("the legend lists the parts the rows hold, in the colours' order, each by its label", () => {
  const colours = new Map([["cache_read", "blue"], ["input", "orange"], ["output", "green"]]);
  const legend = kneeLinesLegend(API_ROWS.filter((row) => row.part !== "input"), colours, { parts: PARTS });
  assert.deepEqual(legend.series, [{ name: "cache_read", label: "Cached input" }, { name: "output", label: "Output" }]);
  assert.equal(legend.colours, colours);
});
