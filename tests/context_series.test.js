import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AGENT_LINE_COLOURS, areaParts, areaRows, markEntries, pointTip, requestPoints, spacedStarts, stepsWithin,
  trajectoryPoints, transitionMarks, turnStarts,
} from "../site/js/session_charts/context_series.js";

// The fixture's `mutation` session: step 1 rewrites its context by compaction, step 3 starts a second turn.
const TREE = [
  { session_id: "mutation", parent_session_id: null, first_start_ms: 1_000_000 },
  { session_id: "helper", parent_session_id: "mutation", first_start_ms: 1_025_000 },
];

function request(sessionId, step, startS, endS, input, fields = {}) {
  return {
    session_id: sessionId, step, turn: 1, start_ms: startS * 1000, end_ms: endS * 1000,
    prompt_tokens: input, cache_read_tokens: 0, uncached_tokens: input,
    system_tokens: 100, user_tokens: 200, assistant_tokens: 300, tool_tokens: 400, tool_definition_tokens: 500,
    transition: "append", cause: null, ...fields,
  };
}

const REQUESTS = [
  request("mutation", 2, 1_200, 1_210, 1_800, { cache_read_tokens: 1_500, uncached_tokens: 300 }),
  request("mutation", 0, 1_000, 1_010, 2_000, { transition: null }),
  request("mutation", 1, 1_020, 1_030, 1_500, { transition: "mutation", cause: "compaction" }),
  request("mutation", 3, 1_300, 1_310, 1_900, { turn: 2, cache_read_tokens: null, uncached_tokens: null }),
  request("helper", 0, 1_025, 1_040, 700, { transition: null }),
];

test("each request is a point at its start, in seconds since the top-level session's first request", () => {
  const points = requestPoints(TREE, REQUESTS);
  const outline = points.map((point) => [point.label, point.step, point.elapsed, point.inputTokens]);
  assert.deepEqual(outline, [
    ["Main", 0, 0, 2_000], ["Main", 1, 20, 1_500], ["Main", 2, 200, 1_800], ["Main", 3, 300, 1_900],
    ["Sub helper", 0, 25, 700],
  ]);
  assert.equal(points[0].isTopLevel, true);
  assert.equal(points[4].isTopLevel, false);
});

test("each agent's line ends at its last request's end, so an agent of one request has a width", () => {
  const helper = trajectoryPoints(TREE, REQUESTS).filter((point) => point.sessionId === "helper");
  assert.deepEqual(helper.map((point) => [point.elapsed, point.inputTokens]), [[25, 700], [40, 700]]);
});

test("the area splits each top-level request into cached and uncached input, the unreported whole uncached", () => {
  const parts = areaParts("tokens");
  assert.deepEqual(parts.map((part) => part.name), ["Cached input", "Uncached input"]);
  assert.equal(parts[0].colour, "var(--token-cached)");
  const rows = areaRows(TREE, REQUESTS, "tokens");
  const atStep2 = rows.filter((row) => row.elapsed === 200).map((row) => row.tokens);
  const atStep3 = rows.filter((row) => row.elapsed === 300).map((row) => row.tokens);
  assert.deepEqual(atStep2, [1_500, 300]);
  assert.deepEqual(atStep3, [0, 1_900]);
  assert.deepEqual(rows.filter((row) => row.elapsed === 310).map((row) => row.tokens), [0, 1_900]);
});

test("split by role, the area stacks the five roles in their role colours", () => {
  const parts = areaParts("roles");
  assert.deepEqual(parts.map((part) => part.name), ["System", "User", "Assistant", "Tool results", "Tool definitions"]);
  const roles = ["system", "user", "assistant", "tool-results", "tool-definitions"];
  assert.deepEqual(parts.map((part) => part.colour), roles.map((role) => `var(--role-${role})`));
  const first = areaRows(TREE, REQUESTS, "roles").filter((row) => row.elapsed === 0).map((row) => row.tokens);
  assert.deepEqual(first, [100, 200, 300, 400, 500]);
});

test("only the top-level session's requests make the area", () => {
  assert.equal(areaRows(TREE, REQUESTS, "tokens").length, 5 * 2);
});

test("a turn starts at the first request of each turn of the top-level session", () => {
  assert.deepEqual(turnStarts(TREE, REQUESTS), [0, 300]);
});

test("the fixture's mutation step is marked, and its tooltip names the transition and its cause", () => {
  const marks = transitionMarks(requestPoints(TREE, REQUESTS));
  assert.deepEqual(marks.map((point) => point.step), [1]);
  assert.match(pointTip(marks[0]), /transition: mutation, compaction/);
});

test("a switch is marked too, and its tooltip names the transition alone", () => {
  const switched = [...REQUESTS, request("mutation", 4, 1_400, 1_410, 900, { transition: "switch", turn: 2 })];
  const marks = transitionMarks(requestPoints(TREE, switched));
  assert.deepEqual(marks.map((point) => point.step), [1, 4]);
  assert.match(pointTip(marks[1]), /transition: switch$/);
});

test("a tooltip gives the agent, step, turn, time and tokens", () => {
  const points = requestPoints(TREE, REQUESTS);
  assert.equal(pointTip(points[2]), "Main · step 2 · turn 1\n3:20\n1.8k input tokens: 1.5k cached, 300 uncached");
  assert.equal(pointTip(points[3]), "Main · step 3 · turn 2\n5:00\n1.9k input tokens: 0 cached, 1.9k uncached");
});

test("the top-level line is the first series and subagents' lines a slot neither area split uses", () => {
  assert.equal(AGENT_LINE_COLOURS.main, "var(--series-1)");
  assert.equal(AGENT_LINE_COLOURS.subagents, "var(--series-7)");
  for (const split of ["tokens", "roles"]) {
    const areaColours = areaParts(split).map((part) => part.colour);
    assert.ok(!areaColours.includes(AGENT_LINE_COLOURS.subagents), split);
  }
});

test("a mutation's dot takes the mutation colour every chart gives it, and a switch's dot ink", () => {
  const switched = [...REQUESTS, request("mutation", 4, 1_400, 1_410, 900, { transition: "switch", turn: 2 })];
  assert.deepEqual(markEntries(transitionMarks(requestPoints(TREE, switched))), [
    { name: "Mutation", colour: "var(--transition-mutation)" },
    { name: "Model or provider switch", colour: "var(--color-text)" },
  ]);
  const names = markEntries(transitionMarks(requestPoints(TREE, REQUESTS))).map((entry) => entry.name);
  assert.deepEqual(names, ["Mutation"]);
});

test("over a time range, each step series is cut at the range's edges, holding its value there", () => {
  const points = [
    { sessionId: "a", elapsed: 0, inputTokens: 10 },
    { sessionId: "a", elapsed: 50, inputTokens: 20 },
    { sessionId: "a", elapsed: 150, inputTokens: 30 },
    { sessionId: "a", elapsed: 250, inputTokens: 30 },
    { sessionId: "before", elapsed: 10, inputTokens: 5 },
    { sessionId: "before", elapsed: 90, inputTokens: 5 },
    { sessionId: "inside", elapsed: 120, inputTokens: 7 },
    { sessionId: "inside", elapsed: 130, inputTokens: 7 },
  ];
  const cut = stepsWithin(points, "sessionId", { start: 100, end: 200 });
  assert.deepEqual(cut.map((point) => [point.sessionId, point.elapsed, point.inputTokens]), [
    ["a", 100, 20], ["a", 150, 30], ["a", 200, 30], ["inside", 120, 7], ["inside", 130, 7],
  ]);
});

test("over the whole session, each part of the area keeps its rows", () => {
  const rows = areaRows(TREE, REQUESTS, "tokens");
  const whole = stepsWithin(rows, "part", { start: 0, end: 310 });
  for (const part of ["Cached input", "Uncached input"]) {
    const before = rows.filter((row) => row.part === part).map((row) => [row.elapsed, row.tokens]);
    const after = whole.filter((row) => row.part === part).map((row) => [row.elapsed, row.tokens]);
    assert.deepEqual(after, before, part);
  }
});

test("a turn's rule is drawn only at least three pixels from the last one drawn, and only within the range", () => {
  // 100 seconds over 100 pixels: a second a pixel.
  const range = { start: 0, end: 100 };
  assert.deepEqual(spacedStarts([0, 1, 2, 3, 10, 11, 150], range, 100), [0, 3, 10]);
  assert.deepEqual(spacedStarts([0, 1, 2, 3], range, 1000), [0, 1, 2, 3]);
});
