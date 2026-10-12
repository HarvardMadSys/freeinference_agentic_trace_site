import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterWords, harnessesWords, monthsOf, monthsWords, namesFilter, readTableFilter, rowsInFilter, unknownFilterNote,
  writeTableFilter,
} from "../site/js/explore/sessions_filter.js";
import { readTableState, shownSessions } from "../site/js/explore/sessions_table_state.js";
import { selectionQuery } from "../site/js/shared/selection.js";

const WEEKS = [
  { week: "2026-06-28", last_day: "2026-07-04", month: "2026-06", simulated: true },
  { week: "2026-07-05", last_day: "2026-07-11", month: "2026-07", simulated: true },
  { week: "2026-07-12", last_day: "2026-07-18", month: "2026-07", simulated: true },
  { week: "2026-08-02", last_day: "2026-08-08", month: "2026-08", simulated: true },
];
const HARNESSES = [
  { harness: "hermes", sessions: 40, benchmark: false },
  { harness: "eval:swe-bench", sessions: 30, benchmark: true },
  { harness: "codex", sessions: 20, benchmark: false },
];
const SESSIONS = [
  { session_id: "a", week: "2026-06-28", harness: "codex", benchmark: false, requests: 150, input_tokens: 1 },
  { session_id: "b", week: "2026-07-05", harness: "codex", benchmark: false, requests: 120, input_tokens: 2 },
  { session_id: "c", week: "2026-07-12", harness: "codex", benchmark: false, requests: 20, input_tokens: 3 },
  { session_id: "d", week: "2026-07-12", harness: "hermes", benchmark: false, requests: 300, input_tokens: 4 },
  { session_id: "e", week: "2026-07-05", harness: "eval:swe-bench", benchmark: true, requests: 90, input_tokens: 5 },
  { session_id: "f", week: "2026-08-02", harness: "hermes", benchmark: false, requests: 10, input_tokens: 6 },
];

/** The filter a query string names. */
function filterOf(query) {
  return readTableFilter(new URLSearchParams(query), WEEKS, HARNESSES);
}

/** The query string the filter a query string names is rewritten as. */
function rewritten(query) {
  const params = new URLSearchParams(query);
  return selectionQuery(writeTableFilter(params, readTableFilter(params, WEEKS, HARNESSES), WEEKS, HARNESSES));
}

/** The ids of the sessions the filter a query string names keeps. */
function keptIds(query) {
  return rowsInFilter(SESSIONS, filterOf(query), WEEKS).map((row) => row.session_id);
}

test("a month is the weeks whose Sunday falls in it", () => {
  assert.deepEqual(monthsOf(WEEKS), ["2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(keptIds("months=2026-06"), ["a"]);
});

test("no key is every month and the paper's harnesses, which leaves the benchmark out and writes no key", () => {
  const everyMonth = ["2026-06", "2026-07", "2026-08"];
  assert.deepEqual(filterOf(""), { months: everyMonth, harnesses: ["hermes", "codex"], unknown: [] });
  assert.deepEqual(keptIds(""), ["a", "b", "c", "d", "f"]);
  assert.equal(rewritten(""), "");
});

test("months=2026-07&harnesses=codex keeps July 2026's codex sessions and reads back as it was", () => {
  const filter = filterOf("months=2026-07&harnesses=codex");
  assert.deepEqual(filter, { months: ["2026-07"], harnesses: ["codex"], unknown: [] });
  assert.deepEqual(keptIds("months=2026-07&harnesses=codex"), ["b", "c"]);
  assert.equal(rewritten("months=2026-07&harnesses=codex"), "?months=2026-07&harnesses=codex");
});

test("two harnesses of a shared link are both kept, in the order of harnesses.json", () => {
  assert.deepEqual(filterOf("months=2026-07&harnesses=codex,hermes").harnesses, ["hermes", "codex"]);
  assert.deepEqual(keptIds("months=2026-07&harnesses=hermes,codex"), ["b", "c", "d"]);
});

test("ticking the benchmark's harness brings its sessions in", () => {
  assert.deepEqual(keptIds("harnesses=hermes,eval:swe-bench,codex"), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(rewritten("harnesses=hermes,eval:swe-bench,codex"), "?harnesses=hermes,eval%3Aswe-bench,codex");
});

test("a link from an earlier release: weeks are read as their months and rewritten as months", () => {
  assert.deepEqual(filterOf("weeks=2026-07-05,2026-07-12&scope=All").months, ["2026-07"]);
  assert.equal(rewritten("weeks=2026-07-05,2026-07-12&scope=All"), "?months=2026-07");
  assert.equal(rewritten("weeks=2026-06-28,2026-07-05"), "?months=2026-06,2026-07");
});

test("a link from the first release: weeks=all and scope are the default and are rewritten away", () => {
  assert.deepEqual(filterOf("weeks=all&scope=All"), filterOf(""));
  assert.equal(rewritten("weeks=all&scope=All"), "");
});

test("an older month or harness key is read as the filter and rewritten in the new keys", () => {
  assert.equal(rewritten("month=2026-07"), "?months=2026-07");
  assert.equal(rewritten("harness=codex"), "?harnesses=codex");
  assert.equal(rewritten("months=2026-08&month=2026-07&weeks=2026-06-28"), "?months=2026-08");
});

test("an unknown week is left out with a note, and the filter keeps the months of the others", () => {
  const filter = filterOf("weeks=2026-07-05,2025-01-05&scope=All");
  assert.deepEqual(filter.months, ["2026-07"]);
  assert.equal(unknownFilterNote(filter), "Not in the data, so not used: week 2025-01-05.");
});

test("an unknown month or harness is ignored and named; with none known, the default holds", () => {
  const filter = filterOf("months=2026-13,2026-13&harnesses=nobody");
  assert.deepEqual(filter.months, ["2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(filter.harnesses, ["hermes", "codex"]);
  assert.equal(unknownFilterNote(filter), "Not in the data, so not used: month 2026-13, harness nobody.");
  assert.equal(rewritten("months=2026-13,2026-07&harnesses=nobody"), "?months=2026-07");
  assert.equal(unknownFilterNote(filterOf("months=2026-07")), "");
});

test("writing the filter keeps the table's other keys, and a filter key already there keeps its place", () => {
  assert.equal(rewritten("sort=requests&weeks=2026-08-02&page=2"), "?sort=requests&page=2&months=2026-08");
  assert.equal(rewritten("harnesses=codex&sort=requests&months=2026-07"), "?harnesses=codex&sort=requests&months=2026-07");
});

test("every month, or none, writes no months key; every harness writes them all", () => {
  const everyHarness = { months: [], harnesses: ["hermes", "eval:swe-bench", "codex"], unknown: [] };
  const params = writeTableFilter(new URLSearchParams(), everyHarness, WEEKS, HARNESSES);
  assert.equal(selectionQuery(params), "?harnesses=hermes,eval%3Aswe-bench,codex");
});

test("the filter is open when the URL names it in its own keys", () => {
  assert.equal(namesFilter(new URLSearchParams("months=2026-07")), true);
  assert.equal(namesFilter(new URLSearchParams("harnesses=codex")), true);
  assert.equal(namesFilter(new URLSearchParams("sort=requests")), false);
});

test("filtering to one harness and a minimum of 100 requests keeps its sessions with at least that many", () => {
  const state = readTableState(new URLSearchParams("min_requests=100"));
  const shown = shownSessions(rowsInFilter(SESSIONS, filterOf("harnesses=codex"), WEEKS), state);
  assert.deepEqual(shown.map((row) => row.session_id), ["b", "a"]);
});

test("the closed line says the filter in words and how many sessions match out of how many", () => {
  const state = readTableState(new URLSearchParams());
  const line = { filter: filterOf(""), state, matching: 5, total: 6, weeks: WEEKS, harnesses: HARNESSES };
  assert.equal(filterWords(line), "Every month · the paper's harnesses · 5 of 6 sessions");
  const narrowed = { ...line, filter: filterOf("months=2026-07&harnesses=codex,eval:swe-bench"), matching: 3 };
  narrowed.state = readTableState(new URLSearchParams("model=glm&min_requests=1000&search=ab12"));
  const words = "July 2026 · eval:swe-bench, codex · main model glm · at least 1,000 requests · id containing \"ab12\"";
  assert.equal(filterWords(narrowed), `${words} · 3 of 6 sessions`);
});

test("months and harnesses in words: every one, none, a few by name, more as a count", () => {
  assert.equal(monthsWords(["2026-06", "2026-07"], WEEKS), "June 2026, July 2026");
  assert.equal(monthsWords([], WEEKS), "No month");
  assert.equal(monthsWords(["2026-01", "2026-02", "2026-03", "2026-04"], WEEKS), "4 months");
  assert.equal(harnessesWords(["hermes", "eval:swe-bench", "codex"], HARNESSES), "every harness");
  assert.equal(harnessesWords([], HARNESSES), "no harness");
  assert.equal(harnessesWords(["codex"], HARNESSES), "codex");
});
