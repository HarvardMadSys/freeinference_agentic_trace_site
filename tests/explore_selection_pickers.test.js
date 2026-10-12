import assert from "node:assert/strict";
import { test } from "node:test";

import { leavesNoneChosen } from "../site/js/explore/selection_pickers.js";

test("the last month ticked, or every month at once, cannot be unticked; another can", () => {
  const everyMonth = ["2026-06", "2026-07", "2026-08"];
  assert.equal(leavesNoneChosen(["2026-07"], ["2026-07"]), true);
  assert.equal(leavesNoneChosen(everyMonth, everyMonth), true);
  assert.equal(leavesNoneChosen(["2026-06", "2026-07"], ["2026-07"]), false);
});

test("a pill that would tick more is never held: an unticked month, or every month while some are ticked", () => {
  assert.equal(leavesNoneChosen(["2026-07"], ["2026-08"]), false);
  assert.equal(leavesNoneChosen(["2026-06", "2026-07"], ["2026-06", "2026-07", "2026-08"]), false);
});

test("the last harness ticked cannot be unticked; one of two can", () => {
  assert.equal(leavesNoneChosen(["codex"], ["codex"]), true);
  assert.equal(leavesNoneChosen(["codex", "hermes"], ["codex"]), false);
});
