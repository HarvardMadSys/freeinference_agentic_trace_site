import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  assignColours, barColours, CAUSE_COLOURS, causeColours, figureColours, GAP_BIN_SLOTS, HARNESS_FIRST_SLOT,
  OTHER_SERIES, SCOPE_COLOURS, SERIES_SLOTS, slottedColours, TIME_PART_COLOURS, TIME_PART_NAMES, TOKEN_PART_COLOURS,
  TOOL_CATEGORY_COLOURS, TOOL_GROUP_COLOURS, TOOL_GROUP_OF_CATEGORY, toolCategoryColour, toolCategoryColours,
  TRANSITION_COLOURS,
} from "../site/js/theme/colours.js";

// The shipped colour orders: every tool category of the release, every harness and every model, most used first.
function shippedOrder(name) {
  return JSON.parse(readFileSync(new URL(`../site/data/all_weeks/setup/${name}_order.json`, import.meta.url), "utf8"));
}

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

test("names may start from a later slot, going round to the first, and the ninth still takes the other colour", () => {
  const colours = assignColours(NINE_MODELS, 4);
  assert.deepEqual([...colours.values()].slice(0, 5), [
    "var(--series-5)", "var(--series-6)", "var(--series-7)", "var(--series-8)", "var(--series-1)",
  ]);
  assert.equal(new Set([...colours.values()].slice(0, 8)).size, 8);
  assert.equal(colours.get("m9"), OTHER_SERIES);
});

test("the largest harness and the largest model do not take the same colour", () => {
  const harnesses = shippedOrder("harness").map((row) => row.harness);
  const models = shippedOrder("model").map((row) => row.model);
  const harnessColour = barColours(harnesses, HARNESS_FIRST_SLOT).get(harnesses[0]);
  assert.notEqual(harnessColour, barColours(models).get(models[0]));
  assert.equal(barColours(harnesses, HARNESS_FIRST_SLOT).get("Other"), OTHER_SERIES);
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

test("the slotted colours are the first eight names in their order, none in the Other grey", () => {
  const slotted = slottedColours(assignColours(NINE_MODELS));
  assert.deepEqual([...slotted.keys()], NINE_MODELS.slice(0, 8));
  assert.ok(![...slotted.values()].includes(OTHER_SERIES));
});

test("the eight tool groups each have their own colour token, and the map cannot be changed", () => {
  const colours = Object.values(TOOL_GROUP_COLOURS);
  assert.equal(colours.length, 8);
  assert.equal(new Set(colours).size, 8);
  assert.equal(TOOL_GROUP_COLOURS["Write/Edit"], "var(--tool-group-write-edit)");
  assert.ok(Object.isFrozen(TOOL_GROUP_COLOURS));
});

test("the paper's harnesses are drawn blue and the benchmark replay red, as the paper draws them", () => {
  assert.deepEqual(Object.entries(SCOPE_COLOURS), [["Agentic", "var(--series-1)"], ["SWE-Bench", "var(--series-8)"]]);
  assert.ok(Object.isFrozen(SCOPE_COLOURS));
});

test("the parts of a session's time take their part tokens, in the paper's order, and cannot be changed", () => {
  assert.deepEqual(Object.entries(TIME_PART_COLOURS), [
    ["prefill", "var(--part-prefill)"],
    ["decode", "var(--part-decode)"],
    ["tool", "var(--part-tool)"],
    ["user", "var(--part-user)"],
  ]);
  assert.ok(Object.isFrozen(TIME_PART_COLOURS));
});

test("the parts of a session's time have one name each, by the keys of their colours", () => {
  assert.deepEqual(Object.entries(TIME_PART_NAMES), [
    ["prefill", "Prefill"], ["decode", "Decode"], ["tool", "Tool wait"], ["user", "User idle"],
  ]);
  assert.deepEqual(Object.keys(TIME_PART_NAMES), Object.keys(TIME_PART_COLOURS));
  assert.ok(Object.isFrozen(TIME_PART_NAMES));
});

test("a tool category takes its tool group's colour, one without a group its own, and Other goes last", () => {
  const colours = toolCategoryColours(["Read", "Other", "Edit", "Write", "MCP", "*File Ops"]);
  assert.deepEqual([...colours.keys()], ["Read", "Edit", "Write", "MCP", "*File Ops", "Other"]);
  assert.equal(colours.get("Read"), TOOL_GROUP_COLOURS.Read);
  assert.equal(colours.get("Edit"), colours.get("Write"));
  assert.equal(colours.get("MCP"), "var(--tool-category-mcp)");
  assert.equal(colours.get("*File Ops"), "var(--tool-category-file-ops)");
  assert.equal(colours.get("Other"), OTHER_SERIES);
});

test("every category of the release has a colour, and only Other is grey", () => {
  const categories = shippedOrder("category").map((row) => row.category);
  assert.deepEqual([...categories].sort(), Object.keys(TOOL_CATEGORY_COLOURS).sort());
  for (const category of categories) {
    const isGrey = toolCategoryColour(category) === OTHER_SERIES;
    assert.equal(isGrey, category === "Other", category);
  }
});

test("a category with a tool group takes the group's colour, and one without shares its colour with no other", () => {
  const sharedColours = new Set(Object.values(TOOL_GROUP_COLOURS));
  for (const [category, colour] of Object.entries(TOOL_CATEGORY_COLOURS)) {
    const group = TOOL_GROUP_OF_CATEGORY[category];
    if (group !== undefined) {
      assert.equal(colour, TOOL_GROUP_COLOURS[group], category);
    } else if (category !== "Other") {
      assert.ok(!sharedColours.has(colour), `${category} takes a group's colour`);
      const others = Object.entries(TOOL_CATEGORY_COLOURS).filter(([name]) => name !== category);
      assert.ok(others.every(([, otherColour]) => otherColour !== colour), `${category} shares its colour`);
    }
  }
});

test("every tool group a category names has a colour", () => {
  for (const group of Object.values(TOOL_GROUP_OF_CATEGORY)) {
    assert.ok(group in TOOL_GROUP_COLOURS, group);
  }
});

test("the figures' colours follow the model and provider orders from the first slot, a category its group's", async () => {
  const orders = {
    models: Promise.resolve([{ model: "model-b" }, { model: "model-a" }]),
    categories: Promise.resolve([{ category: "Other" }, { category: "Read" }, { category: "Edit" }]),
    providers: Promise.resolve([{ provider: "B" }, { provider: "A" }]),
  };
  const colours = await figureColours(orders);
  assert.deepEqual([...colours.models], [["model-b", SERIES_SLOTS[0]], ["model-a", SERIES_SLOTS[1]]]);
  assert.deepEqual([...colours.categories], [
    ["Read", "var(--tool-group-read)"], ["Edit", "var(--tool-group-write-edit)"], ["Other", "var(--series-other)"],
  ]);
  assert.deepEqual([...colours.providers], [["B", SERIES_SLOTS[0]], ["A", SERIES_SLOTS[1]]]);
  assert.ok(Object.isFrozen(colours));
});
