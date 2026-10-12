import assert from "node:assert/strict";
import { test } from "node:test";

import { subagentTicks } from "../site/js/figures/sessions.js";

test("the subagents axis ticks within its bins' range, every other tick on a narrow chart", () => {
  assert.deepEqual(subagentTicks([1, 41], 6), [1, 3, 10, 30]);
  assert.deepEqual(subagentTicks([1, 12], 6), [1, 3, 10]);
  assert.deepEqual(subagentTicks([1, 41], 3), [1, 10]);
});
