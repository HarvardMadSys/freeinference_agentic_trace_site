import assert from "node:assert/strict";
import { test } from "node:test";

import { overlapGroups } from "../site/js/session/overlaps.js";

function intervals(...pairs) {
  return pairs.map(([start_ms, end_ms]) => ({ start_ms, end_ms }));
}

test("requests that do not overlap form no group", () => {
  assert.deepEqual(overlapGroups(intervals([0, 10], [20, 30], [40, 50])), []);
});

test("a request that starts the moment another ends does not overlap it", () => {
  assert.deepEqual(overlapGroups(intervals([0, 10], [10, 20])), []);
});

test("two requests that overlap form one group", () => {
  assert.deepEqual(overlapGroups(intervals([0, 10], [5, 15], [30, 40])), [[0, 1]]);
});

test("a request inside another's interval overlaps it, and so does one after the inner one ends", () => {
  assert.deepEqual(overlapGroups(intervals([0, 100], [10, 20], [50, 60])), [[0, 1, 2]]);
});

test("three requests that all overlap form one group", () => {
  assert.deepEqual(overlapGroups(intervals([0, 30], [10, 40], [20, 50])), [[0, 1, 2]]);
});

test("a chain of overlaps is one group, though its ends do not overlap each other", () => {
  assert.deepEqual(overlapGroups(intervals([0, 10], [5, 20], [15, 30])), [[0, 1, 2]]);
});

test("the indices refer to the input order, each group in start order", () => {
  const requests = intervals([50, 60], [0, 10], [55, 70], [5, 8]);
  assert.deepEqual(overlapGroups(requests), [[1, 3], [0, 2]]);
});

test("separate groups stay apart", () => {
  assert.deepEqual(overlapGroups(intervals([0, 10], [5, 12], [12, 20], [15, 25])), [[0, 1], [2, 3]]);
});

test("no requests, no groups", () => {
  assert.deepEqual(overlapGroups([]), []);
});
