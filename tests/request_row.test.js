import assert from "node:assert/strict";
import { test } from "node:test";

import { barParts, barWidth, chipTitle, elapsedRange, rowLabel } from "../site/js/session_requests/request_row.js";

const REQUEST = {
  step: 3, turn: 2, step_trigger: "tool", start_ms: 61_000, end_ms: 75_500,
  prompt_tokens: 1_000, cache_read_tokens: 600, uncached_tokens: 400, completion_tokens: 50,
};

test("a user step is labelled by its turn, a tool step by its step", () => {
  assert.equal(rowLabel({ ...REQUEST, step_trigger: "user" }), "Turn 2");
  assert.equal(rowLabel(REQUEST), "↳ step 3");
});

test("the elapsed time runs from the origin to the request's end", () => {
  assert.equal(elapsedRange(REQUEST, 1_000), "1:00–1:14");
  assert.equal(elapsedRange({ ...REQUEST, end_ms: 3_725_000 }, 1_000), "1:00–1:02:04");
});

test("a bar is the cached and uncached input, then the output", () => {
  const parts = barParts(REQUEST);
  assert.deepEqual(parts.map((part) => part.tokens), [600, 400, 50]);
  const colours = parts.map((part) => part.colour);
  assert.deepEqual(colours, ["var(--token-cached)", "var(--token-uncached)", "var(--token-output)"]);
  assert.equal(parts[0].title, "600 cached input tokens");
});

test("a request with no cache report shows its whole input as uncached, then its output", () => {
  const parts = barParts({ ...REQUEST, cache_read_tokens: null, uncached_tokens: null });
  assert.deepEqual(parts.map((part) => part.tokens), [1_000, 50]);
  assert.deepEqual(parts.map((part) => part.colour), ["var(--token-uncached)", "var(--token-output)"]);
  assert.deepEqual(parts.map((part) => part.title), ["1,000 uncached input tokens", "50 output tokens"]);
});

test("an empty part is left out", () => {
  const parts = barParts({ ...REQUEST, cache_read_tokens: 0, uncached_tokens: 1_000 });
  assert.deepEqual(parts.map((part) => part.tokens), [1_000, 50]);
});

test("a part's width is its share of the largest request, in percent", () => {
  assert.equal(barWidth(250, 1_000), "25%");
  assert.equal(barWidth(1_000, 1_000), "100%");
});

test("a chip's tooltip names the programs after the category when the call has them", () => {
  const shellCall = { name: "execute_command", category: "Network", programs: ["nc", "echo", "echo"], outcome: "ok" };
  assert.equal(chipTitle(shellCall), "execute_command · Network · nc, echo, echo · ok");
  const nativeCall = { name: "apply_diff", category: "Edit", programs: null, outcome: null };
  assert.equal(chipTitle(nativeCall), "apply_diff · Edit · no outcome");
});
