import assert from "node:assert/strict";
import { test } from "node:test";

import { detailFacts, programsText, skeletonText } from "../site/js/session_requests/request_details.js";

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
  assert.equal(values["Time to first token"], "9.9 s");
  assert.equal(values["Duration"], "10.0 s");
  assert.equal(values["Finish reason"], "tool_calls");
  assert.equal(values["Transition"], "mutation (compaction)");
  assert.equal(values["Waited for"], "subagent, 1.2 min");
});

test("a session's first request has no transition and no wait, and a missing TTFT is a dash", () => {
  const firstRequest = { ...REQUEST, transition: null, cause: null, waited_for: null, wait_s: null, ttft_ms: null };
  const values = factValues(firstRequest);
  assert.equal(values["Transition"], "—");
  assert.equal(values["Waited for"], "—");
  assert.equal(values["Time to first token"], "—");
});

test("an append with no cause names only the transition", () => {
  const values = factValues({ ...REQUEST, transition: "append", cause: null });
  assert.equal(values["Transition"], "append");
});

test("a request with no cache report counts its whole input as uncached", () => {
  const values = factValues({ ...REQUEST, cache_read_tokens: null, uncached_tokens: null });
  assert.equal(values["Input tokens"], "3,000: 0 cached, 3,000 uncached");
});

const SHELL_CALL = {
  name: "execute_command", category: "Network", programs: ["nc", "echo", "echo"],
  arguments_skeleton: '{"command": "nc -z -w <num> <path> <num> && echo <str> || echo <str>"}',
};
const NATIVE_CALL = {
  name: "apply_diff", category: "Edit", programs: null, arguments_skeleton: '{"path": "<path>", "diff": "<path>"}',
};

test("a shell call's programs are joined by commas, and its line is the command alone", () => {
  assert.equal(programsText(SHELL_CALL.programs), "nc, echo, echo");
  assert.equal(skeletonText(SHELL_CALL), "nc -z -w <num> <path> <num> && echo <str> || echo <str>");
});

test("a native call's programs are blank, and its line gives the argument names and value types", () => {
  assert.equal(programsText(NATIVE_CALL.programs), "");
  assert.equal(skeletonText(NATIVE_CALL), "path: <path>, diff: <path>");
});

test("an interpreter call's line is its code", () => {
  const call = { programs: ["python"], arguments_skeleton: '{"code": "print(<str>)", "timeout": "<num>"}' };
  assert.equal(skeletonText(call), "print(<str>)");
});

test("a skeleton that does not parse is shown as it is, and a missing one as a dash", () => {
  assert.equal(skeletonText({ ...NATIVE_CALL, arguments_skeleton: "{not json" }), "{not json");
  assert.equal(skeletonText({ ...NATIVE_CALL, arguments_skeleton: null }), "—");
});

test("a call with no arguments, its skeleton {}, shows a dash rather than an empty line", () => {
  assert.equal(skeletonText({ ...NATIVE_CALL, arguments_skeleton: "{}" }), "—");
  assert.equal(skeletonText({ ...SHELL_CALL, arguments_skeleton: "{}" }), "—");
});
