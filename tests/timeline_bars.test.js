import assert from "node:assert/strict";
import { test } from "node:test";

import {
  barAt, barsWithin, ganttBars, ganttRows, placedInRow, pointerPlace, requestPartEntries, undrawnCounts, waitEntries,
  WAIT_OPACITY,
} from "../site/js/session_charts/timeline_bars.js";
import { assignColours } from "../site/js/theme/colours.js";

// The fixture's tree: `root` spawns `child` and `sibling` from step 1, whose requests overlap; `child` spawns
// `grandchild`. Times are in seconds from 1,000.
const TREE = [
  { session_id: "root", parent_session_id: null, first_start_ms: 1_000_000 },
  { session_id: "sibling", parent_session_id: "root", first_start_ms: 1_032_000 },
  { session_id: "child", parent_session_id: "root", first_start_ms: 1_031_000 },
  { session_id: "grandchild", parent_session_id: "child", first_start_ms: 1_041_000 },
];

function request(sessionId, step, startS, endS, fields = {}) {
  return {
    session_id: sessionId, step, turn: 1, start_ms: startS * 1000, end_ms: endS * 1000, ttft_ms: 2_000,
    waited_for: null, wait_s: null, ...fields,
  };
}

const REQUESTS = [
  request("root", 0, 1_000, 1_010),
  request("root", 1, 1_020, 1_030, { waited_for: "tool", wait_s: 10 }),
  request("root", 2, 1_100, 1_110, { ttft_ms: null, waited_for: "subagent", wait_s: 70 }),
  request("child", 0, 1_031, 1_040),
  request("sibling", 0, 1_032, 1_045),
  request("grandchild", 0, 1_041, 1_050),
];

const CALLS = [
  { session_id: "root", step: 1, call_index: 0, name: "Task", category: "Subagent", latency_ms: 20_000 },
  { session_id: "root", step: 1, call_index: 1, name: "Read", category: "Read", latency_ms: null },
];

const COLOURS = assignColours(["Read", "Subagent"]);

function barsOf(kind) {
  const bars = ganttBars(TREE, REQUESTS, CALLS, COLOURS);
  return bars.filter(kind);
}

test("one row per agent: main first, then every subagent by first start, whatever its depth", () => {
  assert.deepEqual(ganttRows(TREE).map((row) => row.label), ["main", "sub child", "sub sibling", "sub grandchi"]);
});

test("the overlapping subagents sit on separate rows at overlapping times", () => {
  const child = barsOf((bar) => bar.sessionId === "child");
  const sibling = barsOf((bar) => bar.sessionId === "sibling");
  assert.notEqual(child[0].row, sibling[0].row);
  assert.ok(child[0].x1 < sibling.at(-1).x2 && sibling[0].x1 < child.at(-1).x2);
});

test("a request splits at its time to first token into two bars", () => {
  const first = barsOf((bar) => bar.sessionId === "root" && bar.step === 0 && bar.band === "request");
  assert.deepEqual(first.map((bar) => [bar.x1, bar.x2, bar.colour]), [
    [0, 2, "var(--request-ttft)"],
    [2, 10, "var(--request-rest)"],
  ]);
  assert.match(first[0].tip, /^main · step 0 · turn 1\ntime to first token 2.0 s\nrest 8.0 s$/);
});

test("a request without a time to first token is one bar", () => {
  const unreported = barsOf((bar) => bar.step === 2 && bar.opacity === 1);
  assert.deepEqual(unreported.map((bar) => [bar.x1, bar.x2, bar.colour]), [[100, 110, "var(--color-text-faint)"]]);
});

test("a tool call runs from its request's end for its latency, in the tool band, coloured by category", () => {
  const tools = barsOf((bar) => bar.band === "tool");
  assert.deepEqual(tools.map((bar) => [bar.step, bar.x1, bar.x2, bar.colour]), [[1, 30, 50, "var(--series-2)"]]);
  assert.match(tools[0].tip, /^Task · Subagent\nlatency 20.0 s/);
});

test("a wait ends at its request's start, lasts its wait, is lighter and coloured by what it waited for", () => {
  const waits = barsOf((bar) => bar.opacity === WAIT_OPACITY);
  assert.deepEqual(waits.map((bar) => [bar.step, bar.x1, bar.x2, bar.colour]), [
    [1, 10, 20, "var(--cause-tool)"],
    [2, 30, 100, "var(--cause-subagent)"],
  ]);
  assert.equal(waits[1].tip, "waited 1.2 min for subagents\nbefore main step 2");
});

test("a long user wait is a user wait whose tooltip gives its duration", () => {
  const waited = [
    request("root", 0, 1_000, 1_010),
    request("root", 1, 2_210, 2_220, { waited_for: "user", wait_s: 1_200 }),
  ];
  const wait = ganttBars(TREE, waited, [], COLOURS).find((bar) => bar.opacity === WAIT_OPACITY);
  assert.deepEqual([wait.x1, wait.x2, wait.colour], [10, 1_210, "var(--cause-user)"]);
  assert.match(wait.tip, /^waited 20.0 min for the user/);
});

test("tool calls without a positive latency and waits under zero are counted as undrawn", () => {
  const overlapping = [...REQUESTS, request("root", 3, 1_105, 1_120, { waited_for: "tool", wait_s: -5 })];
  assert.deepEqual(undrawnCounts(overlapping, CALLS), { toolCalls: 1, waits: 1 });
  const bars = ganttBars(TREE, overlapping, CALLS, COLOURS);
  assert.equal(bars.filter((bar) => bar.step === 3 && bar.opacity === WAIT_OPACITY).length, 0);
});

test("a bar sits in its band of its row: requests and waits above, tool calls below", () => {
  const request = placedInRow({ row: 2, band: "request" });
  const tool = placedInRow({ row: 2, band: "tool" });
  assert.ok(request.y1 >= 2 && request.y2 <= tool.y1 && tool.y2 <= 3);
});

test("the upper part of a row is its request band, the lower its tool band", () => {
  assert.deepEqual(pointerPlace(2.3), { row: 2, band: "request" });
  assert.deepEqual(pointerPlace(2.8), { row: 2, band: "tool" });
});

test("the pointer finds a long wait by its span, not by the nearest middle", () => {
  const waited = [
    request("root", 0, 1_000, 1_010),
    request("root", 1, 2_210, 2_220, { waited_for: "user", wait_s: 1_200 }),
  ];
  const bars = ganttBars(TREE, waited, [], COLOURS);
  // At 100 s the pointer is 90 s past step 0's end but 510 s short of the wait's middle; it is over the wait.
  const pointed = barAt(bars, { x: 100, row: 0, band: "request", toleranceSeconds: 1 });
  assert.equal(pointed.opacity, WAIT_OPACITY);
  assert.equal(pointed.step, 1);
});

test("the pointer reaches a bar too thin to hold it, within the tolerance, and nothing beyond", () => {
  const bars = [{ row: 0, band: "tool", x1: 50, x2: 50.01, step: 3 }];
  assert.equal(barAt(bars, { x: 50.5, row: 0, band: "tool", toleranceSeconds: 1 }).step, 3);
  assert.equal(barAt(bars, { x: 52, row: 0, band: "tool", toleranceSeconds: 1 }), null);
  assert.equal(barAt(bars, { x: 50.005, row: 0, band: "request", toleranceSeconds: 1 }), null);
  assert.equal(barAt(bars, { x: 50.005, row: 1, band: "tool", toleranceSeconds: 1 }), null);
});

test("of overlapping bars, the pointer finds the one drawn last, on top", () => {
  const bars = [
    { row: 0, band: "tool", x1: 0, x2: 10, step: 1 },
    { row: 0, band: "tool", x1: 0, x2: 4, step: 2 },
  ];
  assert.equal(barAt(bars, { x: 2, row: 0, band: "tool", toleranceSeconds: 0 }).step, 2);
  assert.equal(barAt(bars, { x: 6, row: 0, band: "tool", toleranceSeconds: 0 }).step, 1);
});

test("the legend's request parts are ink tones, the rest naming a request with no time to first token", () => {
  const reported = requestPartEntries([request("root", 0, 1_000, 1_010)]);
  assert.deepEqual(reported, [
    { name: "time to first token", colour: "var(--request-ttft)" },
    { name: "rest of the request", colour: "var(--request-rest)" },
  ]);
  const unreported = requestPartEntries(REQUESTS);
  assert.equal(unreported[1].name, "rest of the request, or all of one with no time to first token");
});

test("the legend lists only the waits present, lighter, in the wait causes' colours", () => {
  assert.deepEqual(waitEntries(REQUESTS), [
    { name: "tools", colour: "var(--cause-tool)", opacity: WAIT_OPACITY },
    { name: "subagents", colour: "var(--cause-subagent)", opacity: WAIT_OPACITY },
  ]);
});

test("over a time range, only the bars that overlap it are drawn, cut at its edges", () => {
  const bars = [
    { step: 0, x1: 0, x2: 50 },
    { step: 1, x1: 90, x2: 130 },
    { step: 2, x1: 140, x2: 160 },
    { step: 3, x1: 190, x2: 260 },
    { step: 4, x1: 300, x2: 320 },
  ];
  const shown = barsWithin(bars, { start: 100, end: 200 });
  assert.deepEqual(shown.map((bar) => [bar.step, bar.x1, bar.x2]), [[1, 100, 130], [2, 140, 160], [3, 190, 200]]);
});
