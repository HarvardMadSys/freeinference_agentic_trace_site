import assert from "node:assert/strict";
import { test } from "node:test";

import { figureColours } from "../site/js/explore/figure_sections.js";
import { SERIES_SLOTS } from "../site/js/shared/charts.js";

test("the figures' colours follow the model and category orders, each from the first series colour", async () => {
  const orders = {
    models: Promise.resolve([{ model: "model-b" }, { model: "model-a" }]),
    categories: Promise.resolve([{ category: "Read" }, { category: "Edit" }]),
  };
  const colours = await figureColours(orders);
  assert.deepEqual([...colours.models], [["model-b", SERIES_SLOTS[0]], ["model-a", SERIES_SLOTS[1]]]);
  assert.deepEqual([...colours.categories], [["Read", SERIES_SLOTS[0]], ["Edit", SERIES_SLOTS[1]]]);
  assert.ok(Object.isFrozen(colours));
});
