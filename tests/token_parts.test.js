import assert from "node:assert/strict";
import { test } from "node:test";

import { tokenPartEntries, tokenParts } from "../site/js/session/token_parts.js";

const REQUEST = { prompt_tokens: 1_000, cache_read_tokens: 600, uncached_tokens: 400, completion_tokens: 50 };

test("a request's tokens are its cached input, uncached input and output", () => {
  assert.deepEqual(tokenParts(REQUEST), { cached: 600, uncached: 400, output: 50 });
});

test("a request with no cache report counts its whole input as uncached", () => {
  const unreported = { ...REQUEST, cache_read_tokens: null, uncached_tokens: null };
  assert.deepEqual(tokenParts(unreported), { cached: 0, uncached: 1_000, output: 50 });
});

test("the legend names the three parts and no other", () => {
  assert.deepEqual(tokenPartEntries().map((entry) => entry.name), ["Cached input", "Uncached input", "Output"]);
  assert.deepEqual(tokenPartEntries().map((entry) => entry.colour), [
    "var(--token-cached)", "var(--token-uncached)", "var(--token-output)",
  ]);
});
