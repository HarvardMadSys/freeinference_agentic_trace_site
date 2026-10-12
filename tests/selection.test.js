import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computationNote, defaultHarnesses, defaultSelection, harnessesText, isDefaultSelection, populationText, readSelection,
  selectionQuery, streamedWeeksNote, streamedWeeksText, unknownSelectionNote, weeksByMonth, withoutSelection,
  writeSelection,
} from "../site/js/shared/selection.js";

// Four weeks over two months, oldest first, as weeks.json holds them.
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-06-07", last_day: "2026-06-13", month: "2026-06", simulated: true },
  { week: "2026-06-14", last_day: "2026-06-20", month: "2026-06", simulated: false },
];
const EVERY_WEEK = ["2026-05-24", "2026-05-31", "2026-06-07", "2026-06-14"];

// Four harnesses, most sessions first, the third the benchmark, as harnesses.json holds them.
const HARNESSES = [
  { harness: "hermes", sessions: 3953, benchmark: false },
  { harness: "opencode", sessions: 1733, benchmark: false },
  { harness: "eval:swe-bench", sessions: 1035, benchmark: true },
  { harness: "codex", sessions: 763, benchmark: false },
];
const PAPER_HARNESSES = ["hermes", "opencode", "codex"];

// The default selection, as `readSelection` gives it for a URL without keys.
const DEFAULT_SELECTION = Object.freeze({
  weeks: EVERY_WEEK, harnesses: PAPER_HARNESSES, unknownWeeks: [], unknownMonth: null, unknownHarnesses: [],
});

function read(query) {
  return readSelection(new URLSearchParams(query), WEEKS, HARNESSES);
}

function write(selection) {
  return writeSelection(new URLSearchParams("sort=requests&weeks=2026-05-24&scope=All"), selection, WEEKS, HARNESSES);
}

test("with no selection in the URL, every week and every harness but the benchmark are selected", () => {
  assert.deepEqual(read(""), DEFAULT_SELECTION);
});

test("the default selection is every week and the paper's harnesses, as a URL without keys reads", () => {
  assert.deepEqual(defaultSelection(WEEKS, HARNESSES), DEFAULT_SELECTION);
  assert.deepEqual(defaultSelection(WEEKS, HARNESSES), readSelection(new URLSearchParams(), WEEKS, HARNESSES));
  assert.equal(isDefaultSelection(defaultSelection(WEEKS, HARNESSES), WEEKS, HARNESSES), true);
});

test("without the selection, the URL keeps every other key and loses weeks, month, harnesses and scope", () => {
  const params = new URLSearchParams("weeks=2026-05-24&month=2026-05&harnesses=codex&scope=All&sort=requests&page=2");
  assert.equal(withoutSelection(params).toString(), "sort=requests&page=2");
  assert.equal(params.get("harnesses"), "codex");
});

test("the default harnesses are every harness but the benchmark, in the file's order", () => {
  assert.deepEqual(defaultHarnesses(HARNESSES), PAPER_HARNESSES);
});

test("weeks=all and a scope key are read as the default", () => {
  assert.deepEqual(read("weeks=all&scope=All"), DEFAULT_SELECTION);
  assert.deepEqual(read("scope=SWE-Bench"), DEFAULT_SELECTION);
});

test("weeks= selects the named weeks, oldest first and without duplicates", () => {
  assert.deepEqual(read("weeks=2026-06-07,2026-05-24,2026-06-07").weeks, ["2026-05-24", "2026-06-07"]);
});

test("month= selects the weeks whose Sunday falls in that month", () => {
  assert.deepEqual(read("month=2026-05").weeks, ["2026-05-24", "2026-05-31"]);
});

test("weeks= takes precedence over month=", () => {
  assert.deepEqual(read("month=2026-05&weeks=2026-06-07").weeks, ["2026-06-07"]);
});

test("spaces around the named weeks are ignored", () => {
  assert.deepEqual(read("weeks= 2026-05-31 , 2026-06-14").weeks, ["2026-05-31", "2026-06-14"]);
});

test("an empty weeks= selects every week", () => {
  assert.deepEqual(read("weeks=").weeks, EVERY_WEEK);
});

test("an unknown week is ignored and reported", () => {
  const selection = read("weeks=2026-05-31,2025-01-05");
  assert.deepEqual(selection.weeks, ["2026-05-31"]);
  assert.deepEqual(selection.unknownWeeks, ["2025-01-05"]);
});

test("when every named week is unknown, every week is selected and the unknown ones reported", () => {
  const selection = read("weeks=2025-01-05,2025-01-12");
  assert.deepEqual(selection.weeks, EVERY_WEEK);
  assert.deepEqual(selection.unknownWeeks, ["2025-01-05", "2025-01-12"]);
});

test("a month that holds no week selects every week and is reported", () => {
  const selection = read("month=2025-01");
  assert.deepEqual(selection.weeks, EVERY_WEEK);
  assert.equal(selection.unknownMonth, "2025-01");
  assert.equal(read("month=2026-05").unknownMonth, null);
});

test("harnesses= selects the named harnesses in the file's order, the benchmark included when named", () => {
  assert.deepEqual(read("harnesses=codex,eval%3Aswe-bench,hermes").harnesses, ["hermes", "eval:swe-bench", "codex"]);
});

test("an unknown harness is ignored and reported", () => {
  const selection = read("harnesses=codex,cursor,cursor");
  assert.deepEqual(selection.harnesses, ["codex"]);
  assert.deepEqual(selection.unknownHarnesses, ["cursor"]);
});

test("when every named harness is unknown, the default harnesses are selected", () => {
  const selection = read("harnesses=cursor");
  assert.deepEqual(selection.harnesses, PAPER_HARNESSES);
  assert.deepEqual(selection.unknownHarnesses, ["cursor"]);
});

test("the default is every week and exactly the default harnesses, in any order", () => {
  assert.equal(isDefaultSelection(DEFAULT_SELECTION, WEEKS, HARNESSES), true);
  const reordered = { ...DEFAULT_SELECTION, harnesses: ["codex", "hermes", "opencode"] };
  assert.equal(isDefaultSelection(reordered, WEEKS, HARNESSES), true);
  assert.equal(isDefaultSelection({ ...DEFAULT_SELECTION, weeks: EVERY_WEEK.slice(1) }, WEEKS, HARNESSES), false);
  assert.equal(isDefaultSelection({ ...DEFAULT_SELECTION, harnesses: ["hermes", "codex"] }, WEEKS, HARNESSES), false);
  const withBenchmark = { ...DEFAULT_SELECTION, harnesses: HARNESSES.map((entry) => entry.harness) };
  assert.equal(isDefaultSelection(withBenchmark, WEEKS, HARNESSES), false);
});

test("the default selection writes no selection key, and drops weeks, month and scope", () => {
  assert.equal(write(DEFAULT_SELECTION).toString(), "sort=requests");
});

test("exactly one whole month is written as month=", () => {
  assert.equal(write({ ...DEFAULT_SELECTION, weeks: ["2026-06-07", "2026-06-14"] }).toString(), "sort=requests&month=2026-06");
});

test("a month of one week is written as month=", () => {
  const weeks = [...WEEKS, { week: "2026-07-05", last_day: "2026-07-11", month: "2026-07", simulated: false }];
  const selection = { ...DEFAULT_SELECTION, weeks: ["2026-07-05"] };
  assert.equal(writeSelection(new URLSearchParams(), selection, weeks, HARNESSES).toString(), "month=2026-07");
});

test("any other weeks are written as a list of weeks", () => {
  const written = write({ ...DEFAULT_SELECTION, weeks: ["2026-05-31", "2026-06-07"] });
  assert.equal(written.get("weeks"), "2026-05-31,2026-06-07");
  assert.equal(written.get("month"), null);
});

test("harnesses other than the default are written in the file's order, every harness included", () => {
  assert.equal(write({ ...DEFAULT_SELECTION, harnesses: ["hermes", "codex"] }).get("harnesses"), "hermes,codex");
  const everyHarness = HARNESSES.map((entry) => entry.harness);
  assert.equal(write({ ...DEFAULT_SELECTION, harnesses: everyHarness }).get("harnesses"), "hermes,opencode,eval:swe-bench,codex");
});

test("a selection with no week or no harness writes no key for it, so a reload opens on the default", () => {
  const written = write({ ...DEFAULT_SELECTION, weeks: [], harnesses: [] });
  assert.equal(written.toString(), "sort=requests");
  assert.deepEqual(readSelection(written, WEEKS, HARNESSES), DEFAULT_SELECTION);
});

test("writing keeps foreign keys and leaves the given parameters unchanged", () => {
  const params = new URLSearchParams("sort=requests");
  const written = writeSelection(params, { ...DEFAULT_SELECTION, weeks: ["2026-05-24"] }, WEEKS, HARNESSES);
  assert.equal(written.get("sort"), "requests");
  assert.equal(written.get("weeks"), "2026-05-24");
  assert.equal(params.toString(), "sort=requests");
});

test("a written selection reads back as itself", () => {
  const selection = { ...DEFAULT_SELECTION, weeks: ["2026-05-24", "2026-06-14"], harnesses: ["eval:swe-bench", "codex"] };
  assert.deepEqual(readSelection(write(selection), WEEKS, HARNESSES), selection);
});

test("the query string keeps the commas of weeks= and harnesses= plain", () => {
  const params = new URLSearchParams("sort=requests");
  params.set("weeks", "2026-05-31,2026-06-07");
  params.set("harnesses", "hermes,codex");
  assert.equal(selectionQuery(params), "?sort=requests&weeks=2026-05-31,2026-06-07&harnesses=hermes,codex");
});

test("no keys give an empty query string", () => {
  assert.equal(selectionQuery(new URLSearchParams()), "");
});

test("weeks are grouped by month, oldest first", () => {
  assert.deepEqual(weeksByMonth(WEEKS), [
    { month: "2026-05", weeks: [WEEKS[0], WEEKS[1]] },
    { month: "2026-06", weeks: [WEEKS[2], WEEKS[3]] },
  ]);
});

test("the note names the weeks, the month and the harnesses the URL asked for that the data do not hold", () => {
  const selection = { ...DEFAULT_SELECTION, unknownWeeks: ["2025-01-05"], unknownMonth: "2025-02", unknownHarnesses: ["cursor"] };
  assert.equal(unknownSelectionNote(selection), "Not in the data, so not selected: 2025-01-05, month 2025-02, harness cursor.");
  assert.equal(unknownSelectionNote(DEFAULT_SELECTION), "");
});

test("the default selection is precomputed, any other computed in the browser", () => {
  assert.equal(computationNote(DEFAULT_SELECTION, WEEKS, HARNESSES), "Every week and the paper's harnesses: precomputed.");
  assert.equal(
    computationNote({ ...DEFAULT_SELECTION, harnesses: ["hermes"] }, WEEKS, HARNESSES),
    "Computed in your browser; a narrowed selection may take a few seconds.",
  );
});

test("with no week or no harness selected there is no computation to note", () => {
  assert.equal(computationNote({ ...DEFAULT_SELECTION, weeks: [] }, WEEKS, HARNESSES), "");
  assert.equal(computationNote({ ...DEFAULT_SELECTION, harnesses: [] }, WEEKS, HARNESSES), "");
});

test("a computed selection's note counts the weeks streamed in out of every week, the newest when some are in", () => {
  const narrowed = { ...DEFAULT_SELECTION, harnesses: ["hermes"] };
  assert.equal(streamedWeeksNote(narrowed, WEEKS, HARNESSES, []), "0 of 4 weeks loaded in your browser.");
  assert.equal(streamedWeeksNote(narrowed, WEEKS, HARNESSES, ["2026-06-14", "2026-06-07"]),
    "The newest 2 of 4 weeks loaded in your browser.");
  assert.equal(streamedWeeksText(EVERY_WEEK, WEEKS), "4 of 4 weeks loaded in your browser.");
});

test("the default selection, an empty one, or a page that does not stream count no weeks streamed", () => {
  assert.equal(streamedWeeksNote(DEFAULT_SELECTION, WEEKS, HARNESSES, ["2026-06-14"]), "");
  assert.equal(streamedWeeksNote({ ...DEFAULT_SELECTION, weeks: [] }, WEEKS, HARNESSES, ["2026-06-14"]), "");
  assert.equal(streamedWeeksNote({ ...DEFAULT_SELECTION, harnesses: ["hermes"] }, WEEKS, HARNESSES, null), "");
});

test("a streamed Sunday that is not a week of weeks.json is not counted", () => {
  assert.equal(streamedWeeksText(["2026-06-14", "2025-01-05"], WEEKS),
    "The newest 1 of 4 weeks loaded in your browser.");
});

test("a caption names the paper's harnesses, every harness, the one harness, or how many", () => {
  assert.equal(harnessesText(PAPER_HARNESSES, HARNESSES), "the paper's harnesses");
  assert.equal(harnessesText(HARNESSES.map((entry) => entry.harness), HARNESSES), "every harness");
  assert.equal(harnessesText(["codex"], HARNESSES), "codex");
  assert.equal(harnessesText(["hermes", "codex"], HARNESSES), "2 harnesses");
});

test("the population every frozen figure draws names the paper's harnesses, the weeks, their days and the unsimulated", () => {
  assert.equal(populationText(WEEKS, HARNESSES),
    "All figures: the paper's harnesses, all 4 weeks (cache simulation: all but 2026-06-14), May 24 to June 20, 2026, "
      + "and the benchmark replay where a legend names it.");
  assert.equal(populationText(WEEKS.slice(0, 1), HARNESSES),
    "All figures: the paper's harnesses, one week, May 24 to May 30, 2026, and the benchmark replay where a legend names it.");
  assert.equal(populationText(WEEKS.slice(3), HARNESSES),
    "All figures: the paper's harnesses, one week (no cache simulation), June 14 to June 20, 2026, "
      + "and the benchmark replay where a legend names it.");
  assert.equal(populationText([], HARNESSES), "");
});
