import assert from "node:assert/strict";
import { test } from "node:test";

import { subagentTicks } from "../site/js/figures/sessions.js";

test("the subagents axis ticks at its bins' edges within their range, every other edge past the most ticks", () => {
  assert.deepEqual(subagentTicks([1, 16], 6), [1, 2, 4, 8, 16]);
  assert.deepEqual(subagentTicks([2, 8], 6), [2, 4, 8]);
  assert.deepEqual(subagentTicks([1, 64], 6), [1, 4, 16, 64]);
});
