import assert from "node:assert/strict";
import { test } from "node:test";

import { legendEntries } from "../site/js/session/request_legend.js";
import { assignColours } from "../site/js/shared/charts.js";

test("the token legend names the three parts, and no cache report only when a request has none", () => {
  const colours = assignColours([]);
  const reported = legendEntries([{ cache_read_tokens: 5 }], colours);
  assert.deepEqual(reported.tokens.map((entry) => entry.name), ["cached input", "uncached input", "output"]);
  const unreported = legendEntries([{ cache_read_tokens: 5 }, { cache_read_tokens: null }], colours);
  assert.equal(unreported.tokens.at(-1).name, "input, no cache report");
  assert.equal(unreported.tokens.at(-1).colour, "var(--series-other)");
});

test("the categories keep their order, and those past the eighth are one Other entry", () => {
  const categories = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  const entries = legendEntries([], assignColours(categories)).categories;
  assert.deepEqual(entries.map((entry) => entry.name), [...categories.slice(0, 8), "Other categories"]);
  assert.equal(entries[0].colour, "var(--series-1)");
});

test("a session without tool calls has no category entries", () => {
  assert.deepEqual(legendEntries([], assignColours([])).categories, []);
});
