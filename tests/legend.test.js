import assert from "node:assert/strict";
import { test } from "node:test";

import { categoryEntries } from "../site/js/session/legend.js";
import { assignColours } from "../site/js/theme/colours.js";

// A site-wide order of ten categories: the last two fold into the Other colour.
const SITE_ORDER = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

test("the category entries list the called categories in the site-wide order, the folded ones as one", () => {
  const calls = [{ category: "I" }, { category: "C" }, { category: "J" }, { category: "A" }];
  assert.deepEqual(categoryEntries(calls, assignColours(SITE_ORDER)), [
    { name: "A", colour: "var(--series-1)" },
    { name: "C", colour: "var(--series-3)" },
    { name: "Other categories", colour: "var(--series-other)" },
  ]);
});
