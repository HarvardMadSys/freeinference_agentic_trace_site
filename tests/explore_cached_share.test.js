import assert from "node:assert/strict";
import { test } from "node:test";

import { cachedShare } from "../site/js/explore/cached_share.js";

test("the cached share is cached over reported input", () => {
  assert.equal(cachedShare(150, 200), 0.75);
});

test("the cached share is missing when no input was reported", () => {
  assert.equal(cachedShare(0, 0), null);
});
