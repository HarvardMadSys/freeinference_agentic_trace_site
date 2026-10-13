import assert from "node:assert/strict";
import { test } from "node:test";

import { partsLegend, rowsWithSeriesColour, seriesLegend, shownRows } from "../site/js/shared/series.js";

// Two series of a CDF query, `requests` and `tool_steps`, two points each.
const ROWS = [
  { series: "requests", x: 3, share: 0 },
  { series: "requests", x: 40, share: 1 },
  { series: "tool_steps", x: 0, share: 0 },
  { series: "tool_steps", x: 12, share: 1 },
];

test("a long-format figure keeps the rows of the series not hidden, in their order", () => {
  const rows = [{ model: "a", x: 1 }, { model: "b", x: 2 }, { model: "a", x: 3 }];
  assert.deepEqual(shownRows(rows, "model", new Set(["b"])), [{ model: "a", x: 1 }, { model: "a", x: 3 }]);
  assert.deepEqual(shownRows(rows, "model", new Set()), rows);
});

test("a legend lists the series the rows hold, in the colours' order, each labelled where it has a label", () => {
  const colours = new Map([["requests", "red"], ["user_steps", "blue"], ["tool_steps", "green"]]);
  const legend = seriesLegend(ROWS, "series", colours, { tool_steps: "Tool steps" });
  assert.deepEqual(legend.series, [{ name: "requests", label: "requests" }, { name: "tool_steps", label: "Tool steps" }]);
  assert.equal(legend.colours, colours);
});

test("a legend of parts lists each part with its label, in order, with the colours given", () => {
  const colours = new Map([["cached", "green"], ["uncached", "orange"], ["output", "blue"]]);
  const legend = partsLegend({ cached: "Cached input", uncached: "Uncached input", output: "Output" }, colours);
  assert.deepEqual(legend.series, [
    { name: "cached", label: "Cached input" },
    { name: "uncached", label: "Uncached input" },
    { name: "output", label: "Output" },
  ]);
  assert.equal(legend.colours, colours);
});

test("the rows drawn as lines are those of a series with a series colour, never one in the Other grey", () => {
  const colours = new Map([["A", "var(--series-1)"], ["B", "var(--series-other)"]]);
  const rows = [{ provider: "A" }, { provider: "B" }, { provider: "C" }];
  assert.deepEqual(rowsWithSeriesColour(rows, "provider", colours), [{ provider: "A" }]);
});
