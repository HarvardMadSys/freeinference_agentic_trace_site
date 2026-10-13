import assert from "node:assert/strict";
import { test } from "node:test";

import {
  agentLabel, agentsInStartOrder, agentTree, callsByRequest, largestRequestTokens, requestKey, topLevelSession,
} from "../site/js/session/tree.js";

// The fixture's tree: `root` spawns `child` and `sibling` from step 1, and `child` spawns `grandchild` from step 0.
const SESSIONS = [
  { session_id: "root", parent_session_id: null, spawned_by_step: null, first_start_ms: 0 },
  { session_id: "sibling", parent_session_id: "root", spawned_by_step: 1, first_start_ms: 32 },
  { session_id: "child", parent_session_id: "root", spawned_by_step: 1, first_start_ms: 31 },
  { session_id: "grandchild", parent_session_id: "child", spawned_by_step: 0, first_start_ms: 41 },
];
const REQUESTS = [
  { session_id: "root", step: 0, start_ms: 0 },
  { session_id: "root", step: 2, start_ms: 100 },
  { session_id: "root", step: 1, start_ms: 20 },
  { session_id: "child", step: 0, start_ms: 31 },
  { session_id: "child", step: 1, start_ms: 60 },
  { session_id: "sibling", step: 0, start_ms: 32 },
  { session_id: "grandchild", step: 0, start_ms: 41 },
];

/** The tree as `[step, [subagent trees…]]` per row, with session ids, so a test can compare it whole. */
function outline(agent) {
  return [agent.session.session_id, agent.rows.map((row) => [row.request.step, row.subagents.map(outline)])];
}

test("the top-level session is the one no other session spawned, wherever it is listed", () => {
  assert.equal(topLevelSession([...SESSIONS].reverse()).session_id, "root");
});

test("each subagent sits under the row of the step that spawned it, nested to any depth", () => {
  assert.deepEqual(outline(agentTree(SESSIONS, REQUESTS)), [
    "root", [
      [0, []],
      [1, [["child", [[0, [["grandchild", [[0, []]]]]], [1, []]]], ["sibling", [[0, []]]]]],
      [2, []],
    ],
  ]);
});

test("an agent's rows are in start order, the step breaking a tie", () => {
  const requests = [
    { session_id: "root", step: 1, start_ms: 50 },
    { session_id: "root", step: 0, start_ms: 60 },
    { session_id: "root", step: 3, start_ms: 70 },
    { session_id: "root", step: 2, start_ms: 70 },
  ];
  const steps = agentTree([SESSIONS[0]], requests).rows.map((row) => row.request.step);
  assert.deepEqual(steps, [1, 0, 2, 3]);
});

test("a subagent whose spawning step has no request sits under its parent's last row", () => {
  const sessions = [SESSIONS[0], { ...SESSIONS[2], spawned_by_step: 9 }];
  const tree = agentTree(sessions, REQUESTS.filter((request) => request.session_id !== "grandchild"));
  assert.deepEqual(tree.rows.at(-1).subagents.map((agent) => agent.session.session_id), ["child"]);
});

test("tool calls are grouped by their request, in the order given", () => {
  const calls = [
    { session_id: "a", step: 0, call_index: 0 },
    { session_id: "a", step: 0, call_index: 1 },
    { session_id: "b", step: 0, call_index: 0 },
  ];
  const grouped = callsByRequest(calls);
  assert.deepEqual(grouped.get(requestKey("a", 0)), [calls[0], calls[1]]);
  assert.deepEqual(grouped.get(requestKey("b", 0)), [calls[2]]);
  assert.equal(grouped.get(requestKey("a", 1)), undefined);
});

test("a full bar stands for the largest input plus output of one request", () => {
  const requests = [{ prompt_tokens: 100, completion_tokens: 50 }, { prompt_tokens: 120, completion_tokens: 10 }];
  assert.equal(largestRequestTokens(requests), 150);
  assert.equal(largestRequestTokens([]), 1);
});

test("an agent is named Main at the top level and Sub with its short id below", () => {
  assert.equal(agentLabel({ session_id: "740dd162030203354c9e55d40fb3a2d5", parent_session_id: null }), "Main");
  assert.equal(agentLabel({ session_id: "5478226ab25bd5e4c254bb945ba7068b", parent_session_id: "x" }), "Sub 5478226a");
});

test("the agents run top-level first, then every subagent by first start, whatever its depth", () => {
  const order = agentsInStartOrder(SESSIONS).map((session) => session.session_id);
  assert.deepEqual(order, ["root", "child", "sibling", "grandchild"]);
});
