import assert from "node:assert/strict";
import { test } from "node:test";

import {
  centreUnit, donutArcs, donutLegend, donutSlices, legendSeries, pointAt, ringSegmentPath, sliceShares,
} from "../site/js/charts/donut.js";
import { barColours } from "../site/js/theme/colours.js";

// Ten models, most requests first, as `setup/model_order` gives them.
const MODEL_ORDER = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9", "m10"];

test("a donut names the first eight of the order, folds the rest into Other, and leaves out a name with no rows", () => {
  const rows = [
    { model: "m2", requests: 20 },
    { model: "m1", requests: 50 },
    { model: "m9", requests: 4 },
    { model: "m10", requests: 1 },
    { model: "m8", requests: 5 },
  ];
  assert.deepEqual(donutSlices(rows, "model", "requests", MODEL_ORDER), [
    { name: "m1", count: 50 },
    { name: "m2", count: 20 },
    { name: "m8", count: 5 },
    { name: "Other", count: 5 },
  ]);
});

test("the named slices run largest first where the colour order and the counts disagree, Other last", () => {
  const rows = [
    { model: "m1", requests: 10 },
    { model: "m2", requests: 30 },
    { model: "m3", requests: 20 },
    { model: "m9", requests: 40 },
  ];
  assert.deepEqual(donutSlices(rows, "model", "requests", MODEL_ORDER).map((slice) => slice.name), [
    "m2", "m3", "m1", "Other",
  ]);
});

test("the centre names what its total counts, and says so once a slice is hidden", () => {
  assert.equal(centreUnit("requests", 0), "requests");
  assert.equal(centreUnit("sessions", 2), "shown sessions");
});

test("the harness donut sums each harness's sessions over the weeks", () => {
  const rows = [
    { week: "2026-05-17", harness: "hermes", sessions: 3 },
    { week: "2026-05-24", harness: "hermes", sessions: 4 },
    { week: "2026-05-24", harness: "pi", sessions: 2 },
  ];
  assert.deepEqual(donutSlices(rows, "harness", "sessions", ["hermes", "pi"]), [
    { name: "hermes", count: 7 },
    { name: "pi", count: 2 },
  ]);
});

test("each slice's share is its count over the slices' total", () => {
  const shares = sliceShares([{ name: "a", count: 3 }, { name: "b", count: 1 }]);
  assert.deepEqual(shares.map((slice) => slice.share), [0.75, 0.25]);
});

test("the arcs run clockwise from the top, each as wide as its share of the turn", () => {
  const arcs = donutArcs([{ name: "a", count: 1 }, { name: "b", count: 3 }], 100, 60);
  assert.deepEqual(arcs.map((arc) => [arc.name, arc.startAngle, arc.endAngle]), [
    ["a", 0, Math.PI / 2],
    ["b", Math.PI / 2, 2 * Math.PI],
  ]);
});

test("a point is measured clockwise from the top of the circle", () => {
  assert.equal(pointAt(0, 100), "0 -100");
  assert.equal(pointAt(Math.PI / 2, 100), "100 0");
  assert.equal(pointAt(Math.PI, 100), "0 100");
});

test("a quarter ring goes along the outer circle, in, and back along the inner one", () => {
  assert.equal(ringSegmentPath(0, Math.PI / 2, 100, 60), "M 0 -100 A 100 100 0 0 1 100 0 L 60 0 A 60 60 0 0 0 0 -60 Z");
});

test("a segment longer than half the turn sets the large-arc flag", () => {
  assert.match(ringSegmentPath(0, 1.5 * Math.PI, 100, 60), /^M 0 -100 A 100 100 0 1 1 -100 0 L -60 0 A 60 60 0 1 0 0 -60 Z$/);
});

test("one slice of the whole turn is drawn as the whole ring, two circles of two halves", () => {
  const path = donutArcs([{ name: "a", count: 5 }], 100, 60)[0].path;
  assert.equal(path, "M 0 -100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 0 -100 "
    + "M 0 -60 A 60 60 0 1 0 0 60 A 60 60 0 1 0 0 -60 Z");
});

test("each legend entry names its slice by its label where it has one, and its share of every slice", () => {
  const slices = [{ name: "eval:swe-bench", count: 3 }, { name: "Other", count: 1 }];
  assert.deepEqual(legendSeries(slices, { "eval:swe-bench": "swe-bench" }), [
    { name: "eval:swe-bench", label: "swe-bench 75.0%" },
    { name: "Other", label: "Other 25.0%" },
  ]);
});

test("a donut with no labels writes each slice's name as given", () => {
  const slices = [{ name: "glm-5.3-flash", count: 1 }, { name: "Other", count: 1 }];
  assert.deepEqual(legendSeries(slices), [
    { name: "glm-5.3-flash", label: "glm-5.3-flash 50.0%" },
    { name: "Other", label: "Other 50.0%" },
  ]);
});

test("a donut's legend lists its slices largest first, Other last, the eight series colours named and the rest folded", () => {
  const colours = barColours(MODEL_ORDER);
  const rows = [
    { week: "w1", model: "m2", requests: 20 },
    { week: "w2", model: "m2", requests: 20 },
    { week: "w1", model: "m1", requests: 30 },
    { week: "w1", model: "m10", requests: 5 },
  ];
  const legend = donutLegend(rows, colours, { nameColumn: "model", countColumn: "requests", labels: { m1: "Model 1" } });
  assert.deepEqual(legend.series, [
    { name: "m2", label: "m2 53.3%" },
    { name: "m1", label: "Model 1 40.0%" },
    { name: "Other", label: "Other 6.7%" },
  ]);
  assert.equal(legend.colours, colours);
});
