import assert from "node:assert/strict";
import { test } from "node:test";

import { idleGapEdgeSeconds } from "../site/js/figures/caching.js";

test("the idle-gap edges run geometrically from 10 s to one hour in 26 bins, as the pipeline's do", () => {
  assert.equal(idleGapEdgeSeconds(0), 10);
  assert.ok(Math.abs(idleGapEdgeSeconds(26) - 3600) < 1e-9);
  // each bin is 1.25 times as wide as the one before: 360 ** (1 / 26)
  assert.ok(Math.abs(idleGapEdgeSeconds(1) / idleGapEdgeSeconds(0) - 360 ** (1 / 26)) < 1e-12);
  assert.ok(Math.abs(idleGapEdgeSeconds(0.5) - Math.sqrt(idleGapEdgeSeconds(0) * idleGapEdgeSeconds(1))) < 1e-9);
});
