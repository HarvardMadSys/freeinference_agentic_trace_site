import assert from "node:assert/strict";
import { test } from "node:test";

import { detailFacts } from "../site/js/session/request_details.js";

const REQUEST = {
  model: "model-x", provider: "A", prompt_tokens: 3_000, cache_read_tokens: 2_000, uncached_tokens: 1_000,
  system_tokens: 100, user_tokens: 200, assistant_tokens: 100, tool_tokens: 2_300, tool_definition_tokens: 300,
  completion_tokens: 100, n_messages: 6, ttft_ms: 9_900, start_ms: 1_000, end_ms: 11_000,
  finish_reason: "tool_calls",
  transition: "mutation", cause: "compaction", waited_for: "subagent", wait_s: 70,
};

function factValues(request) {
  const values = {};
  for (const fact of detailFacts(request)) {
    values[fact.label] = fact.value;
  }
  return values;
}

test("the details give the input by role and how it was cached", () => {
  const values = factValues(REQUEST);
  assert.equal(values["Input tokens"], "3,000: 2,000 cached, 1,000 uncached");
  assert.equal(values["Tool results"], "2,300");
  assert.equal(values["Tool definitions"], "300");
});

test("the details give the timing, the end, the transition and the wait", () => {
  const values = factValues(REQUEST);
  assert.equal(values["Time to first token"], "9.9s");
  assert.equal(values["Duration"], "10s");
  assert.equal(values["Finish reason"], "tool_calls");
  assert.equal(values["Transition"], "mutation (compaction)");
  assert.equal(values["Waited for"], "subagent, 1m 10s");
});

test("a session's first request has no transition and no wait, and a missing TTFT is a dash", () => {
  const firstRequest = { ...REQUEST, transition: null, cause: null, waited_for: null, wait_s: null, ttft_ms: null };
  const values = factValues(firstRequest);
  assert.equal(values["Transition"], "—");
  assert.equal(values["Waited for"], "—");
  assert.equal(values["Time to first token"], "—");
});

test("an append with no cause names only the transition, and no cache report is said", () => {
  const values = factValues({ ...REQUEST, transition: "append", cause: null, cache_read_tokens: null });
  assert.equal(values["Transition"], "append");
  assert.equal(values["Input tokens"], "3,000, no cache report");
});
