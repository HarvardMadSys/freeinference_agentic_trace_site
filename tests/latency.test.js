import assert from "node:assert/strict";
import { test } from "node:test";

import {
  drawnModelRows, modelCdfLegend, SPEEDUP_AXIS_HEADROOM, speedupAxisEnd, speedupBars,
} from "../site/js/figures/latency.js";
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

// The speed-up query's rows, in another order than the bars'.
const SPEEDUP_ROWS = [
  { part: "tool", speedup: 1.3757, rows: 10967 },
  { part: "prefill", speedup: 1.0944, rows: 10967 },
  { part: "decode", speedup: 1.1637, rows: 10967 },
];

test("the speed-up bars are prefill, decode and tools, top down, each labelled with its multiple", () => {
  assert.deepEqual(speedupBars(SPEEDUP_ROWS), [
    { part: "prefill", label: "Prefill 2×", speedup: 1.0944, text: "1.09×" },
    { part: "decode", label: "Decode 2×", speedup: 1.1637, text: "1.16×" },
    { part: "tool", label: "Tools 2×", speedup: 1.3757, text: "1.38×" },
  ]);
  assert.deepEqual(speedupBars([]), []);
});

test("the speed-up axis runs past the largest bar's gain by the headroom, and from 1× with no bar", () => {
  assert.equal(speedupAxisEnd(speedupBars(SPEEDUP_ROWS)), 1 + 0.3757 * SPEEDUP_AXIS_HEADROOM);
  assert.equal(speedupAxisEnd([]), 1);
});
