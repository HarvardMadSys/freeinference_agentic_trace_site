import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assignColours, barColours, CAUSE_COLOURS, causeColours, GAP_BIN_SLOTS, OTHER_SERIES, SERIES_SLOTS, TOKEN_PART_COLOURS,
  TRANSITION_COLOURS,
} from "../site/js/theme/colours.js";

const NINE_MODELS = ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];

test("the eight series slots are the series tokens in order, and cannot be changed", () => {
  assert.equal(SERIES_SLOTS.length, 8);
  assert.equal(SERIES_SLOTS[0], "var(--series-1)");
  assert.equal(SERIES_SLOTS[7], "var(--series-8)");
  assert.ok(Object.isFrozen(SERIES_SLOTS));
  assert.ok(Object.isFrozen(TOKEN_PART_COLOURS));
  assert.equal(TOKEN_PART_COLOURS.cached, "var(--token-cached)");
});

test("names get the slots in the order given", () => {
  const colours = assignColours(["claude-code", "codex", "aider"]);
  assert.deepEqual([...colours.entries()], [
    ["claude-code", "var(--series-1)"],
    ["codex", "var(--series-2)"],
    ["aider", "var(--series-3)"],
  ]);
});

test("a repeated name keeps its first slot and takes no other", () => {
  const colours = assignColours(["codex", "aider", "codex", "opencode"]);
  assert.deepEqual([...colours.entries()], [
    ["codex", "var(--series-1)"],
    ["aider", "var(--series-2)"],
    ["opencode", "var(--series-3)"],
  ]);
});

test("the same order gives the same colours on every call", () => {
  assert.deepEqual(assignColours(NINE_MODELS), assignColours(NINE_MODELS));
});

test("the ninth name and beyond take the other colour", () => {
  const colours = assignColours([...NINE_MODELS, "m10"]);
  assert.equal(colours.get("m8"), "var(--series-8)");
  assert.equal(colours.get("m9"), OTHER_SERIES);
  assert.equal(colours.get("m10"), "var(--series-other)");
});

test("a bar chart's colours are the first eight names' series colours and Other's", () => {
  const colours = barColours(NINE_MODELS);
  assert.deepEqual([...colours.keys()], ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "Other"]);
  assert.equal(colours.get("m8"), SERIES_SLOTS[7]);
  assert.equal(colours.get("Other"), OTHER_SERIES);
});

test("the wait causes take their cause tokens in the paper's order", () => {
  assert.deepEqual([...causeColours()], [
    ["tool", "var(--cause-tool)"],
    ["ask_user_tool", "var(--cause-ask-user)"],
    ["user", "var(--cause-user)"],
    ["subagent", "var(--cause-subagent)"],
  ]);
});

test("every fixed colour map is frozen, and the gap bins take six tokens, shortest gap first", () => {
  for (const colours of [CAUSE_COLOURS, TRANSITION_COLOURS, GAP_BIN_SLOTS]) {
    assert.ok(Object.isFrozen(colours));
  }
  assert.deepEqual(GAP_BIN_SLOTS, [1, 2, 3, 4, 5, 6].map((slot) => `var(--gap-bin-${slot})`));
});
