import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assignColours,
  captionText,
  chartFrame,
  colourScale,
  dropThinBins,
  foldToOther,
  MIN_ROWS_PER_BIN,
  OTHER_SERIES,
  SERIES_SLOTS,
  sumFolded,
  TOKEN_PART_COLOURS,
  weeksText,
} from "../site/js/shared/charts.js";

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

test("names past the first eight fold into Other, and the rows are not changed in place", () => {
  const rows = [{ model: "m1", requests: 5 }, { model: "m9", requests: 3 }, { model: "unlisted", requests: 1 }];
  const folded = foldToOther(rows, "model", NINE_MODELS);
  assert.deepEqual(folded, [{ model: "m1", requests: 5 }, { model: "Other", requests: 3 }, { model: "Other", requests: 1 }]);
  assert.equal(rows[1].model, "m9");
});

test("folding counts the first eight distinct names, not the first eight entries", () => {
  const names = ["m1", "m1", "m2", "m3", "m4", "m5", "m6", "m7", "m8", "m9"];
  const folded = foldToOther([{ model: "m8" }, { model: "m9" }], "model", names);
  assert.deepEqual(folded, [{ model: "m8" }, { model: "Other" }]);
});

test("rows sharing a bar and a series are summed into one, in order of first appearance", () => {
  const rows = [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 30 },
    { week: "2026-08-02", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "Other", sessions: 7 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
    { week: "2026-08-09", harness: "Other", sessions: 5 },
  ];
  assert.deepEqual(sumFolded(rows, { x: "week", y: "sessions", fill: "harness" }), [
    { week: "2026-08-02", harness: "m1", sessions: 400 },
    { week: "2026-08-02", harness: "Other", sessions: 42 },
    { week: "2026-08-09", harness: "Other", sessions: 12 },
    { week: "2026-08-09", harness: "m1", sessions: 380 },
  ]);
  assert.equal(rows[1].sessions, 30);
});

test("folding then summing leaves one Other row per bar", () => {
  const rows = [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "m9", requests: 4 }, { week: "w1", model: "m10", requests: 5 }];
  const summed = sumFolded(foldToOther(rows, "model", NINE_MODELS), { x: "week", y: "requests", fill: "model" });
  assert.deepEqual(summed, [{ week: "w1", model: "m8", requests: 3 }, { week: "w1", model: "Other", requests: 9 }]);
});

test("a bin with exactly the minimum rows is kept, and one below it is hidden", () => {
  assert.equal(MIN_ROWS_PER_BIN, 50);
  const rows = [{ bin: "a", requests: 50 }, { bin: "b", requests: 49 }, { bin: "c", requests: 1200 }, { bin: "d", requests: 0 }];
  assert.deepEqual(dropThinBins(rows, "requests"), {
    rows: [{ bin: "a", requests: 50 }, { bin: "c", requests: 1200 }],
    hidden: 2,
  });
});

test("counts that DuckDB returns as BigInt are compared like numbers", () => {
  const rows = [{ bin: "a", requests: 50n }, { bin: "b", requests: 49n }];
  assert.deepEqual(dropThinBins(rows, "requests"), { rows: [{ bin: "a", requests: 50n }], hidden: 1 });
});

test("a caption over several weeks gives their count", () => {
  const weeks = Array.from({ length: 16 }, (_, index) => `week-${index}`);
  assert.equal(captionText({ rows: 1186582, scope: "Agentic", weeks }), "1,186,582 rows · Agentic · 16 weeks");
});

test("a caption over one week names its Sunday", () => {
  assert.equal(captionText({ rows: 4100, scope: "All", weeks: ["2026-08-09"] }), "4,100 rows · All · 1 week (2026-08-09)");
});

test("a caption's weeks are counted, or the one week named by its Sunday", () => {
  assert.equal(weeksText(["2026-08-02", "2026-08-09"]), "2 weeks");
  assert.equal(weeksText(["2026-08-09"]), "1 week (2026-08-09)");
});

test("every chart starts from the same frame, as wide as its body", () => {
  const frame = chartFrame({ clientWidth: 300 });
  assert.equal(frame.width, 300);
  assert.equal(frame.height, chartFrame({ clientWidth: 600 }).height);
  assert.equal(chartFrame({ clientWidth: 0 }).width, 480); // a body not yet laid out gets the fallback width
});

test("a colour scale keeps each shown name's colour from the map, in the order shown", () => {
  const colours = assignColours(["m1", "m2", "m3"]);
  assert.deepEqual(colourScale(colours, ["m3", "m1"], true), {
    type: "ordinal",
    domain: ["m3", "m1"],
    range: ["var(--series-3)", "var(--series-1)"],
    legend: true,
  });
});
