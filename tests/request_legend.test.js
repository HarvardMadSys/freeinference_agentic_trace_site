import assert from "node:assert/strict";
import { test } from "node:test";

import { legendEntries } from "../site/js/session_requests/request_legend.js";
import { assignColours, toolCategoryColours } from "../site/js/theme/colours.js";

// A site-wide order of categories: three with a tool group, two without.
const SITE_ORDER = ["Read", "MCP", "*Search", "Edit", "Subagent"];

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
  const entries = legendEntries(calls("*Search", "Read", "*Search"), toolCategoryColours(SITE_ORDER)).categories;
  assert.deepEqual(entries, [
    { name: "Read", colour: "var(--tool-group-read)" },
    { name: "*Search", colour: "var(--tool-group-search)" },
  ]);
});

test("categories with no tool group each have an entry in their own colour, and Other alone is grey", () => {
  const order = [...SITE_ORDER, "Other"];
  const entries = legendEntries(calls("Subagent", "Edit", "MCP", "Other"), toolCategoryColours(order)).categories;
  assert.deepEqual(entries.map((entry) => entry.name), ["MCP", "Edit", "Subagent", "Other"]);
  assert.equal(entries[0].colour, "var(--tool-category-mcp)");
  assert.equal(entries[3].colour, "var(--series-other)");
});

test("a session without tool calls has no category entries", () => {
  assert.deepEqual(legendEntries([], toolCategoryColours(SITE_ORDER)).categories, []);
});
