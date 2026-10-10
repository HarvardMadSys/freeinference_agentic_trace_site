import assert from "node:assert/strict";
import { test } from "node:test";

import { barParts, barWidth, elapsedRange, rowLabel } from "../site/js/session/request_row.js";

const REQUEST = {
  step: 3, turn: 2, step_trigger: "tool", start_ms: 61_000, end_ms: 75_500,
  prompt_tokens: 1_000, cache_read_tokens: 600, uncached_tokens: 400, completion_tokens: 50,
};

test("a user step is labelled by its turn, a tool step by its step", () => {
  assert.equal(rowLabel({ ...REQUEST, step_trigger: "user" }), "Turn 2");
  assert.equal(rowLabel(REQUEST), "↳ step 3");
});

test("the elapsed time runs from the origin to the request's end", () => {
  assert.equal(elapsedRange(REQUEST, 1_000), "+01:00–01:14");
  assert.equal(elapsedRange({ ...REQUEST, end_ms: 3_725_000 }, 1_000), "+01:00–1:02:04");
});

test("a bar is the cached and uncached input, then the output", () => {
  const parts = barParts(REQUEST);
  assert.deepEqual(parts.map((part) => part.tokens), [600, 400, 50]);
  const colours = parts.map((part) => part.colour);
  assert.deepEqual(colours, ["var(--token-cached)", "var(--token-uncached)", "var(--token-output)"]);
  assert.equal(parts[0].title, "600 cached input tokens");
});

test("a request with no cache report shows its whole input in the Other colour", () => {
  const parts = barParts({ ...REQUEST, cache_read_tokens: null, uncached_tokens: null });
  assert.deepEqual(parts.map((part) => part.tokens), [1_000, 50]);
  assert.equal(parts[0].colour, "var(--series-other)");
  assert.equal(parts[0].title, "1,000 input tokens, no cache report");
});

test("an empty part is left out", () => {
  const parts = barParts({ ...REQUEST, cache_read_tokens: 0, uncached_tokens: 1_000 });
  assert.deepEqual(parts.map((part) => part.tokens), [1_000, 50]);
});

test("a part's width is its share of the largest request, in percent", () => {
  assert.equal(barWidth(250, 1_000), "25%");
  assert.equal(barWidth(1_000, 1_000), "100%");
});
