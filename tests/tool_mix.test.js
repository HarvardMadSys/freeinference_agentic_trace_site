import assert from "node:assert/strict";
import { test } from "node:test";

import {
  stepPoints, TENTHS, TOOL_MIX_BY_TURN_POSITION, toolMixPoints, toolMixTips, turnTicks,
} from "../site/js/comparison/tool_mix.js";
import { dropThinGroups, restingCountText } from "../site/js/figures/figure_rows.js";
import { TOOL_GROUP_COLOURS } from "../site/js/theme/colours.js";

// Rows of the tool mix query: the benchmark's first tenth holds Read and Search, its last only Read, and the
// human-driven scope's first tenth only Search; the human-driven scope has 60 calls, the benchmark's 40.
const ROWS = [
  { scope: "Agentic", tenth: 0, tool_group: "Search", calls: 60, share: 1, rows: 60 },
  { scope: "SWE-Bench", tenth: 0, tool_group: "Read", calls: 30, share: 0.75, rows: 40 },
  { scope: "SWE-Bench", tenth: 0, tool_group: "Search", calls: 5, share: 0.125, rows: 40 },
  { scope: "SWE-Bench", tenth: 9, tool_group: "Read", calls: 5, share: 0.125, rows: 40 },
];

test("every scope has a point per tenth and group, a missing one a share of zero, human-driven first", () => {
  const points = toolMixPoints(ROWS, ["Read", "Search"]);
  assert.equal(points.length, 2 * TENTHS * 2);
  assert.deepEqual(points.slice(0, 2), [
    { scope: "Agentic", tenth: 0, turnPercent: 5, group: "Read", share: 0 },
    { scope: "Agentic", tenth: 0, turnPercent: 5, group: "Search", share: 1 },
  ]);
  const benchmarkLast = points.filter((point) => point.scope === "SWE-Bench" && point.tenth === 9);
  assert.deepEqual(benchmarkLast.map((point) => [point.turnPercent, point.group, point.share]), [
    [95, "Read", 0.125],
    [95, "Search", 0],
  ]);
});

test("a hidden group has no points, and the shown groups keep their shares", () => {
  const points = toolMixPoints(ROWS, ["Read"]);
  assert.equal(points.length, 2 * TENTHS);
  assert.equal(points.find((point) => point.scope === "SWE-Bench" && point.tenth === 0).share, 0.75);
});

test("a tenth's tooltip points at the top of its stack and lists its groups top first", () => {
  const tips = toolMixTips(toolMixPoints(ROWS, ["Read", "Search"]));
  assert.equal(tips.length, 2 * TENTHS);
  const benchmarkFirst = tips.find((tip) => tip.scope === "SWE-Bench" && tip.turnPercent === 5);
  assert.equal(benchmarkFirst.top, 0.875);
  assert.equal(benchmarkFirst.text, "Benchmark, 0–10% of the turn\nSearch: 12.5%\nRead: 75.0%");
});

test("the legend lists the rows' groups in the pipeline's order, each in its own colour", () => {
  const { series, colours } = TOOL_MIX_BY_TURN_POSITION.legend(ROWS, {}, "tool_group");
  assert.deepEqual(series, [{ name: "Read", label: "Read" }, { name: "Search", label: "Search" }]);
  assert.equal(colours.get("Read"), TOOL_GROUP_COLOURS.Read);
});

test("a narrow chart labels one tick per panel, a wide one three", () => {
  assert.deepEqual(turnTicks(300), [50]);
  assert.deepEqual(turnTicks(900), [0, 50, 100]);
});

test("each scope is a bin of its calls, hidden whole when thin, and the caption counts each scope's calls", () => {
  const { rows, hidden } = dropThinGroups(ROWS, TOOL_MIX_BY_TURN_POSITION.binColumn);
  assert.equal(hidden, 1);
  assert.deepEqual([...new Set(rows.map((row) => row.scope))], ["Agentic"]);
  assert.equal(restingCountText(ROWS, TOOL_MIX_BY_TURN_POSITION), "60 human-driven calls · 40 benchmark calls");
});

test("each tenth's share is drawn from the tenth's start, the last one again at the turn's end", () => {
  const steps = stepPoints(toolMixPoints(ROWS, ["Read"]).filter((point) => point.scope === "SWE-Bench"));
  assert.deepEqual(steps.slice(0, 2).map((point) => point.turnPercent), [0, 10]);
  assert.deepEqual(steps.slice(-2).map((point) => [point.tenth, point.turnPercent]), [[9, 90], [9, 100]]);
});
