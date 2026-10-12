import assert from "node:assert/strict";
import { test } from "node:test";

import { legendEntries } from "../site/js/session_requests/request_legend.js";
import { assignColours } from "../site/js/theme/colours.js";

// A site-wide order of ten categories: the last two fold into the Other colour.
const SITE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function calls(...categories) {
  return categories.map((category) => ({ category }));
}

test("the token legend names the three parts, and no cache report only when a request has none", () => {
  const colours = assignColours([]);
  const reported = legendEntries([{ cache_read_tokens: 5 }], [], colours);
  assert.deepEqual(reported.tokens.map((entry) => entry.name), ["Cached input", "Uncached input", "Output"]);
  const unreported = legendEntries([{ cache_read_tokens: 5 }, { cache_read_tokens: null }], [], colours);
  assert.equal(unreported.tokens.at(-1).name, "Input, no cache report");
  assert.equal(unreported.tokens.at(-1).colour, "var(--series-other)");
});

test("only the session's categories are listed, in the site-wide order with its colours", () => {
  const entries = legendEntries([], calls("C", "A", "C"), assignColours(SITE_ORDER)).categories;
  assert.deepEqual(entries, [{ name: "A", colour: "var(--series-1)" }, { name: "C", colour: "var(--series-3)" }]);
});

test("categories past the eighth of the site-wide order are one Other categories entry", () => {
  const entries = legendEntries([], calls("J", "B", "I"), assignColours(SITE_ORDER)).categories;
  assert.deepEqual(entries.map((entry) => entry.name), ["B", "Other categories"]);
  assert.equal(entries[1].colour, "var(--series-other)");
});

test("a session without tool calls has no category entries", () => {
  assert.deepEqual(legendEntries([], [], assignColours(SITE_ORDER)).categories, []);
});
