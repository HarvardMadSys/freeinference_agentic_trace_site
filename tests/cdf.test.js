import assert from "node:assert/strict";
import { test } from "node:test";

import { cdfPoints, lineLabelPoints } from "../site/js/shared/cdf.js";

// Two CDF series of three points each, as `cdfSeries` gives them.
const SERIES = [
  { name: "short", label: "Under 1 min", points: [{ x: 0, share: 0 }, { x: 0.5, share: 0.2 }, { x: 1, share: 1 }] },
  { name: "long", label: "Over 1 h", points: [{ x: 0, share: 0.4 }, { x: 0.6, share: 0.7 }, { x: 1, share: 1 }] },
];

test("the points of every series form one list, each naming its series and label", () => {
  const points = cdfPoints(SERIES);
  assert.equal(points.length, 6);
  assert.deepEqual(points[3], { name: "long", label: "Over 1 h", x: 0, share: 0.4 });
});

test("a series named for a label writes it at its point nearest the value asked; the others write none", () => {
  assert.deepEqual(lineLabelPoints(SERIES, [{ name: "long", at: 0.5, placement: "above" }]), [
    { x: 0.6, share: 0.7, label: "Over 1 h", placement: "above" },
  ]);
  assert.deepEqual(lineLabelPoints(SERIES, []), []);
  const empty = [{ name: "empty", label: "Empty", points: [] }];
  assert.deepEqual(lineLabelPoints(empty, [{ name: "empty", at: 0, placement: "below" }]), []);
});
