import assert from "node:assert/strict";
import { test } from "node:test";

import { legendEntries } from "../site/js/session_requests/request_legend.js";
import { assignColours } from "../site/js/theme/colours.js";

// A site-wide order of ten categories: the last two fold into the Other colour.
const SITE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

function calls(...categories) {
  return categories.map((category) => ({ category }));
}

test("the token legend names only the three parts, in their fixed colours", () => {
  assert.deepEqual(legendEntries([], assignColours([])).tokens, [
    { name: "Cached input", colour: "var(--token-cached)" },
    { name: "Uncached input", colour: "var(--token-uncached)" },
    { name: "Output", colour: "var(--token-output)" },
  ]);
});

test("only the session's categories are listed, in the site-wide order with its colours", () => {
  const entries = legendEntries(calls("C", "A", "C"), assignColours(SITE_ORDER)).categories;
  assert.deepEqual(entries, [{ name: "A", colour: "var(--series-1)" }, { name: "C", colour: "var(--series-3)" }]);
});

test("categories past the eighth of the site-wide order are one Other categories entry", () => {
  const entries = legendEntries(calls("J", "B", "I"), assignColours(SITE_ORDER)).categories;
  assert.deepEqual(entries.map((entry) => entry.name), ["B", "Other categories"]);
  assert.equal(entries[1].colour, "var(--series-other)");
});

test("a session without tool calls has no category entries", () => {
  assert.deepEqual(legendEntries([], assignColours(SITE_ORDER)).categories, []);
});
