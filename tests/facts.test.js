import assert from "node:assert/strict";
import { test } from "node:test";

import { requestsPerModel, sessionFacts } from "../site/js/session/facts.js";

const TOP_LEVEL = {
  depth: 0, harness: "claude-code", first_start_ms: Date.UTC(2026, 7, 9, 14, 3, 59),
  duration_s: 754, user_steps: 4, requests: 30, subagents: 3, subagent_requests: 40, tool_calls: 25,
  input_tokens: 9_000, cached_tokens: 6_000, output_tokens: 500, reported_input_tokens: 8_000,
};
const SUBAGENT = {
  depth: 1, harness: "claude-code", first_start_ms: 0, duration_s: 10, user_steps: 1,
  requests: 40, subagents: 0, subagent_requests: 0, tool_calls: 7,
  input_tokens: 1_000, cached_tokens: 0, output_tokens: 100, reported_input_tokens: 2_000,
};

function factValues(tree, requests) {
  const values = {};
  for (const fact of sessionFacts(tree, requests)) {
    values[fact.label] = [fact.value, fact.detail];
  }
  return values;
}

test("a session's subagents and their requests are given apart from the top-level session's", () => {
  const values = factValues([TOP_LEVEL, SUBAGENT], [{ model: "model-x" }]);
  assert.deepEqual(values["Requests"], ["30", "+ 40 in subagents"]);
  assert.deepEqual(values["Subagents"], ["3", ""]);
  assert.deepEqual(values["Tool calls"], ["25", "+ 7 in subagents"]);
  assert.deepEqual(values["Turns"], ["4", "+ 1 in subagents"]);
});

test("token totals and the cached share cover every agent", () => {
  const values = factValues([TOP_LEVEL, SUBAGENT], [{ model: "model-x" }]);
  assert.equal(values["Input tokens"][0], "10k");
  assert.deepEqual(values["Cached share"], ["60%", "6k cached tokens"]);
  assert.equal(values["Output tokens"][0], "600");
});

test("a session without subagents gives no subagent detail", () => {
  const values = factValues([{ ...TOP_LEVEL, subagents: 0, subagent_requests: 0 }], [{ model: "model-x" }]);
  assert.deepEqual(values["Turns"], ["4", ""]);
  assert.deepEqual(values["Requests"], ["30", ""]);
  assert.deepEqual(values["Tool calls"], ["25", ""]);
});

test("a session with no cache-reporting input has no cached share", () => {
  const values = factValues([{ ...TOP_LEVEL, reported_input_tokens: 0 }], [{ model: "model-x" }]);
  assert.equal(values["Cached share"][0], "—");
});

test("the start is the UTC minute and the models carry their requests", () => {
  const requests = [{ model: "model-y" }, { model: "model-x" }, { model: "model-y" }];
  const values = factValues([TOP_LEVEL], requests);
  assert.deepEqual(values["Started"], ["2026-08-09", "14:03 UTC"]);
  assert.deepEqual(values["Harness"], ["claude-code", ""]);
  assert.deepEqual(values["Models"], ["2", "model-y 2\nmodel-x 1"]);
});

test("no tile's detail restates its label, and the Models tile alone is wide", () => {
  const facts = sessionFacts([TOP_LEVEL], [{ model: "model-x" }]);
  for (const label of ["Harness", "Duration", "Subagents", "Input tokens", "Output tokens"]) {
    assert.equal(facts.find((fact) => fact.label === label).detail, "", label);
  }
  assert.deepEqual(facts.filter((fact) => fact.isWide).map((fact) => fact.label), ["Models"]);
});

test("models with as many requests are in name order", () => {
  const requests = [{ model: "b" }, { model: "a" }, { model: "c" }, { model: "c" }];
  assert.deepEqual(requestsPerModel(requests), [
    { model: "c", requests: 2 }, { model: "a", requests: 1 }, { model: "b", requests: 1 },
  ]);
});
