import assert from "node:assert/strict";
import { test } from "node:test";

import { shortSessionId } from "../site/js/session/tree.js";

test("a session's short name is the first eight characters of its id", () => {
  assert.equal(shortSessionId("740dd162030203354c9e55d40fb3a2d5"), "740dd162");
  assert.equal(shortSessionId("tree"), "tree");
});
