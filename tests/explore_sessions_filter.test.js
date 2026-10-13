import assert from "node:assert/strict";
import { test } from "node:test";

import {
  harnessChoices, monthChoices, monthsOf, readTableFilter, rowsInFilter, unknownFilterNote, writeTableFilter,
} from "../site/js/explore/sessions_filter.js";
import { readTableState, shownSessions } from "../site/js/explore/sessions_table_state.js";
import { selectionQuery } from "../site/js/shared/layout.js";

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
/** The start of a session at `time` (an ISO date and time, UTC), as the table's rows hold it: in milliseconds. */
function startedAt(time) {
  return Date.parse(`${time}Z`);
}

const SESSIONS = [
  { session_id: "a", week: "2026-06-28", harness: "codex", benchmark: false, requests: 150, first_start_ms: startedAt("2026-06-29T10:00") },
  { session_id: "b", week: "2026-07-05", harness: "codex", benchmark: false, requests: 120, first_start_ms: startedAt("2026-07-06T10:00") },
  { session_id: "c", week: "2026-07-12", harness: "codex", benchmark: false, requests: 20, first_start_ms: startedAt("2026-07-13T10:00") },
  { session_id: "d", week: "2026-07-12", harness: "hermes", benchmark: false, requests: 300, first_start_ms: startedAt("2026-07-14T10:00") },
  { session_id: "e", week: "2026-07-05", harness: "eval:swe-bench", benchmark: true, requests: 90, first_start_ms: startedAt("2026-07-07T10:00") },
  { session_id: "f", week: "2026-08-02", harness: "hermes", benchmark: false, requests: 10, first_start_ms: startedAt("2026-08-03T10:00") },
];

/** The filter a query string names. */
function filterOf(query) {
  return readTableFilter(new URLSearchParams(query), WEEKS, HARNESSES);
}

/** The query string the filter a query string names is rewritten as. */
function rewritten(query) {
  const params = new URLSearchParams(query);
  return selectionQuery(writeTableFilter(params, readTableFilter(params, WEEKS, HARNESSES)));
}

/** The ids of the sessions the filter a query string names keeps. */
function keptIds(query) {
  return rowsInFilter(SESSIONS, filterOf(query)).map((row) => row.session_id);
}

test("the months are every calendar month from the first week's Sunday to the last week's Saturday", () => {
  assert.deepEqual(monthsOf(WEEKS), ["2026-06", "2026-07", "2026-08"]);
  assert.deepEqual(keptIds("months=2026-06"), ["a"]);
  assert.deepEqual(monthsOf([{ week: "2026-11-29", last_day: "2026-12-05" }, { week: "2027-01-03", last_day: "2027-01-09" }]),
    ["2026-11", "2026-12", "2027-01"]);
  assert.deepEqual(monthsOf([]), []);
});

// The data's ends: the first week begins mid-May, and the last, the week of August 30, ends on September 5.
const WEEKS_TO_SEPTEMBER = [
  { week: "2026-05-17", last_day: "2026-05-23", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-08-30", last_day: "2026-09-05", month: "2026-08", simulated: true },
];

test("a session started June 6, in the week of May 31, is June's, not May's", () => {
  const sessions = [
    { session_id: "may", week: "2026-05-31", harness: "pi", first_start_ms: startedAt("2026-05-31T23:59") },
    { session_id: "june", week: "2026-05-31", harness: "pi", first_start_ms: startedAt("2026-06-06T12:00") },
  ];
  const kept = (month) => rowsInFilter(sessions, { month, harness: "", unknown: [] }).map((row) => row.session_id);
  assert.deepEqual(kept("2026-05"), ["may"]);
  assert.deepEqual(kept("2026-06"), ["june"]);
});

test("September is a month to choose when the last week ends in it, and lists the sessions started in it", () => {
  assert.deepEqual(monthChoices(WEEKS_TO_SEPTEMBER).map((choice) => choice.text), [
    "All months", "May 2026", "June 2026", "July 2026", "August 2026", "September 2026",
  ]);
  const sessions = [
    { session_id: "aug", week: "2026-08-30", harness: "pi", first_start_ms: startedAt("2026-08-31T08:00") },
    { session_id: "sep", week: "2026-08-30", harness: "pi", first_start_ms: startedAt("2026-09-05T20:00") },
  ];
  const filter = readTableFilter(new URLSearchParams("months=2026-09"), WEEKS_TO_SEPTEMBER, HARNESSES);
  assert.deepEqual(filter.unknown, []);
  assert.deepEqual(rowsInFilter(sessions, filter).map((row) => row.session_id), ["sep"]);
});

test("no key is every month and every harness, the benchmark's included, and writes no key", () => {
  assert.deepEqual(filterOf(""), { month: "", harness: "", unknown: [] });
  assert.deepEqual(keptIds(""), ["a", "b", "c", "d", "e", "f"]);
  assert.equal(rewritten(""), "");
});

test("months=2026-07 lists July 2026's sessions of every harness, the benchmark's included", () => {
  assert.deepEqual(filterOf("months=2026-07"), { month: "2026-07", harness: "", unknown: [] });
  assert.deepEqual(keptIds("months=2026-07"), ["b", "c", "d", "e"]);
  assert.equal(rewritten("months=2026-07"), "?months=2026-07");
});

test("months=2026-07&harnesses=codex keeps July 2026's codex sessions and reads back as it was", () => {
  assert.deepEqual(filterOf("months=2026-07&harnesses=codex"), { month: "2026-07", harness: "codex", unknown: [] });
  assert.deepEqual(keptIds("months=2026-07&harnesses=codex"), ["b", "c"]);
  assert.equal(rewritten("months=2026-07&harnesses=codex"), "?months=2026-07&harnesses=codex");
});

test("a key naming several harnesses or months keeps its first", () => {
  assert.equal(rewritten("months=2026-07&harnesses=hermes,codex"), "?months=2026-07&harnesses=hermes");
  assert.deepEqual(keptIds("months=2026-07&harnesses=hermes,codex"), ["d"]);
  assert.equal(rewritten("months=2026-08,2026-06"), "?months=2026-08");
});

test("the benchmark's harness chosen alone lists its sessions alone", () => {
  assert.deepEqual(keptIds("harnesses=eval:swe-bench"), ["e"]);
  assert.equal(rewritten("harnesses=eval:swe-bench"), "?harnesses=eval%3Aswe-bench");
});

test("a link from an earlier release: weeks are read as their month and rewritten as months", () => {
  assert.equal(filterOf("weeks=2026-07-05,2026-07-12&scope=All").month, "2026-07");
  assert.equal(rewritten("weeks=2026-07-05,2026-07-12&scope=All"), "?months=2026-07");
  assert.equal(rewritten("weeks=2026-06-28,2026-07-05"), "?months=2026-06");
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

test("an unknown week is left out with a note, and the filter keeps the month of the others", () => {
  const filter = filterOf("weeks=2026-07-05,2025-01-05&scope=All");
  assert.equal(filter.month, "2026-07");
  assert.equal(unknownFilterNote(filter), "Not in the data, so not used: week 2025-01-05.");
});

test("an unknown month or harness is ignored and named; with none known, every one", () => {
  const filter = filterOf("months=2026-13,2026-13&harnesses=nobody");
  assert.deepEqual(filter, { month: "", harness: "", unknown: ["month 2026-13", "harness nobody"] });
  assert.equal(unknownFilterNote(filter), "Not in the data, so not used: month 2026-13, harness nobody.");
  assert.equal(rewritten("months=2026-13,2026-07&harnesses=nobody"), "?months=2026-07");
  assert.equal(unknownFilterNote(filterOf("months=2026-07")), "");
});

test("writing the filter keeps the table's other keys, and a filter key already there keeps its place", () => {
  assert.equal(rewritten("sort=requests&weeks=2026-08-02&page=2"), "?sort=requests&page=2&months=2026-08");
  assert.equal(rewritten("harnesses=codex&sort=requests&months=2026-07"), "?harnesses=codex&sort=requests&months=2026-07");
});

test("the month drop-down offers every month by name after All months", () => {
  assert.deepEqual(monthChoices(WEEKS), [
    { value: "", text: "All months" },
    { value: "2026-06", text: "June 2026" },
    { value: "2026-07", text: "July 2026" },
    { value: "2026-08", text: "August 2026" },
  ]);
});

test("the harness drop-down offers every harness after All harnesses, the benchmark named as such", () => {
  assert.deepEqual(harnessChoices(HARNESSES), [
    { value: "", text: "All harnesses" },
    { value: "hermes", text: "hermes" },
    { value: "eval:swe-bench", text: "swe-bench (benchmark)" },
    { value: "codex", text: "codex" },
  ]);
});

test("filtering to one harness and a minimum of 100 requests keeps its sessions with at least that many", () => {
  const state = readTableState(new URLSearchParams("min_requests=100"));
  const shown = shownSessions(rowsInFilter(SESSIONS, filterOf("harnesses=codex")), state);
  assert.deepEqual(shown.map((row) => row.session_id), ["b", "a"]);
});
