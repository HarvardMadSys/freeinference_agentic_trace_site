import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryEntries } from "../site/js/session/legend.js";
import { toolCategoryColours } from "../site/js/theme/colours.js";

// A site-wide order of categories: four with a tool group, two without, and the category Other.
const SITE_ORDER = ["Read", "Other", "*Interpreter", "MCP", "Edit", "Write", "Subagent"];

test("the category entries list the called categories in their own colours, the category Other last", () => {
  const calls = [{ category: "Subagent" }, { category: "Edit" }, { category: "Other" }, { category: "Read" }];
  assert.deepEqual(categoryEntries(calls, toolCategoryColours(SITE_ORDER)), [
    { name: "Read", colour: "var(--tool-group-read)" },
    { name: "Edit", colour: "var(--tool-group-write-edit)" },
    { name: "Subagent", colour: "var(--tool-category-subagent)" },
    { name: "Other", colour: "var(--series-other)" },
  ]);
});

test("categories that share a colour are one entry, named after their tool group, so no two entries share a swatch", () => {
  const calls = [{ category: "Write" }, { category: "Edit" }, { category: "Read" }, { category: "MCP" }];
  assert.deepEqual(categoryEntries(calls, toolCategoryColours(SITE_ORDER)), [
    { name: "Read", colour: "var(--tool-group-read)" },
    { name: "MCP", colour: "var(--tool-category-mcp)" },
    { name: "Write/Edit", colour: "var(--tool-group-write-edit)" },
  ]);
});
