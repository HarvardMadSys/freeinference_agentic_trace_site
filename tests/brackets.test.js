import assert from "node:assert/strict";
import { test } from "node:test";

import { assignLanes } from "../site/js/session/brackets.js";

test("brackets that do not cross share the first lane", () => {
  assert.deepEqual(assignLanes([{ top: 0, bottom: 10 }, { top: 20, bottom: 30 }], 6), [0, 0]);
});

test("a bracket that crosses another takes the next lane, and a freed lane is used again", () => {
  const spans = [{ top: 0, bottom: 50 }, { top: 10, bottom: 20 }, { top: 30, bottom: 40 }, { top: 60, bottom: 70 }];
  assert.deepEqual(assignLanes(spans, 6), [0, 1, 1, 0]);
});

test("brackets that meet at one row take separate lanes", () => {
  assert.deepEqual(assignLanes([{ top: 0, bottom: 10 }, { top: 10, bottom: 20 }], 6), [0, 1]);
});

test("a bracket that finds every lane taken gets none", () => {
  const spans = [{ top: 0, bottom: 50 }, { top: 5, bottom: 50 }, { top: 10, bottom: 50 }, { top: 60, bottom: 70 }];
  assert.deepEqual(assignLanes(spans, 2), [0, 1, null, 0]);
});
