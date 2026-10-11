import assert from "node:assert/strict";
import { test } from "node:test";

import { drawnModelRows, modelCdfLegend } from "../site/js/figures/sessions_latency.js";
import { assignColours, OTHER_SERIES } from "../site/js/theme/colours.js";

// Ten models in the order of most requests over every week: the ninth and tenth take the Other grey.
const MODEL_ORDER = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"];
const FIGURE_COLOURS = Object.freeze({ models: assignColours(MODEL_ORDER), categories: new Map(), providers: new Map() });

// The CDF rows of a selection whose five models with most requests include the ninth and tenth over every week.
const SELECTION_ROWS = ["m9", "m2", "m10", "m7", "m4"].map((model) => ({ series: model, x: 1, share: 0.5, rows: 60 }));

test("a model CDF lists the selection's models among the eight with most requests, none in the Other grey", () => {
  const legend = modelCdfLegend(SELECTION_ROWS, FIGURE_COLOURS, "series");
  assert.deepEqual(legend.series.map((one) => one.name), ["m2", "m4", "m7"]);
  const swatches = legend.series.map((one) => legend.colours.get(one.name));
  assert.ok(!swatches.includes(OTHER_SERIES));
  assert.equal(new Set(swatches).size, swatches.length, "no two models share a colour");
});

test("a model CDF draws, and its caption counts, only the rows of the models its legend lists", () => {
  const drawn = drawnModelRows(SELECTION_ROWS, FIGURE_COLOURS);
  assert.deepEqual(drawn.map((row) => row.series), ["m2", "m7", "m4"]);
});

test("a model keeps the colour of its place over every week, whatever the selection", () => {
  const legend = modelCdfLegend(SELECTION_ROWS, FIGURE_COLOURS, "series");
  assert.equal(legend.colours.get("m7"), "var(--series-7)");
});
