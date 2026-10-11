import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AGENT_LINE_COLOURS, areaParts, areaRows, markEntries, pointTip, requestPoints, trajectoryPoints, transitionMarks,
  turnStarts,
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
    ["main", 0, 0, 2_000], ["main", 1, 20, 1_500], ["main", 2, 200, 1_800], ["main", 3, 300, 1_900],
    ["sub helper", 0, 25, 700],
  ]);
  assert.equal(points[0].isTopLevel, true);
  assert.equal(points[4].isTopLevel, false);
});

test("each agent's line ends at its last request's end, so an agent of one request has a width", () => {
  const helper = trajectoryPoints(TREE, REQUESTS).filter((point) => point.sessionId === "helper");
  assert.deepEqual(helper.map((point) => [point.elapsed, point.inputTokens]), [[25, 700], [40, 700]]);
});

test("the area splits each top-level request into cached and uncached input, the unreported whole apart", () => {
  const parts = areaParts(TREE, REQUESTS, "tokens");
  assert.deepEqual(parts.map((part) => part.name), ["cached input", "uncached input", "input, no cache report"]);
  assert.equal(parts[0].colour, "var(--token-cached)");
  const rows = areaRows(TREE, REQUESTS, "tokens");
  const atStep2 = rows.filter((row) => row.elapsed === 200).map((row) => row.tokens);
  const atStep3 = rows.filter((row) => row.elapsed === 300).map((row) => row.tokens);
  assert.deepEqual(atStep2, [1_500, 300, 0]);
  assert.deepEqual(atStep3, [0, 0, 1_900]);
  assert.deepEqual(rows.filter((row) => row.elapsed === 310).map((row) => row.tokens), [0, 0, 1_900]);
});

test("a session whose every request reports its cache reads has no unreported part", () => {
  const reported = REQUESTS.filter((one) => one.cache_read_tokens !== null);
  assert.deepEqual(areaParts(TREE, reported, "tokens").map((part) => part.name), ["cached input", "uncached input"]);
});

test("split by role, the area stacks the five roles in the first five series colours", () => {
  const parts = areaParts(TREE, REQUESTS, "roles");
  assert.deepEqual(parts.map((part) => part.name), ["system", "user", "assistant", "tool results", "tool definitions"]);
  assert.deepEqual(parts.map((part) => part.colour), [1, 2, 3, 4, 5].map((slot) => `var(--series-${slot})`));
  const first = areaRows(TREE, REQUESTS, "roles").filter((row) => row.elapsed === 0).map((row) => row.tokens);
  assert.deepEqual(first, [100, 200, 300, 400, 500]);
});

test("only the top-level session's requests make the area", () => {
  assert.equal(areaRows(TREE, REQUESTS, "tokens").length, 5 * 3);
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
  assert.equal(pointTip(points[2]), "main · step 2 · turn 1\n+03:20\n1.8k input tokens: 1.5k cached, 300 uncached");
  assert.equal(pointTip(points[3]), "main · step 3 · turn 2\n+05:00\n1.9k input tokens, no cache report");
});

test("the top-level line is the first series and subagents' lines a slot neither area split uses", () => {
  assert.equal(AGENT_LINE_COLOURS.main, "var(--series-1)");
  assert.equal(AGENT_LINE_COLOURS.subagents, "var(--series-7)");
  for (const split of ["tokens", "roles"]) {
    const areaColours = areaParts(TREE, REQUESTS, split).map((part) => part.colour);
    assert.ok(!areaColours.includes(AGENT_LINE_COLOURS.subagents), split);
  }
});

test("a mutation's dot takes the mutation colour every chart gives it, and a switch's dot ink", () => {
  const switched = [...REQUESTS, request("mutation", 4, 1_400, 1_410, 900, { transition: "switch", turn: 2 })];
  assert.deepEqual(markEntries(transitionMarks(requestPoints(TREE, switched))), [
    { name: "mutation", colour: "var(--transition-mutation)" },
    { name: "switch", colour: "var(--color-text)" },
  ]);
  assert.deepEqual(markEntries(transitionMarks(requestPoints(TREE, REQUESTS))).map((entry) => entry.name), ["mutation"]);
});
