import assert from "node:assert/strict";
import { test } from "node:test";

import {
  choices,
  linkedColumns,
  nextSort,
  readTableState,
  sessionLink,
  shortId,
  shownSessions,
  startedText,
  withCachedShare,
  withFirstPage,
  writeTableState,
} from "../site/js/explore/sessions_table.js";

const DEFAULT_STATE = {
  search: "",
  harness: "",
  model: "",
  minRequests: null,
  sort: { key: "input_tokens", direction: "descending" },
  pageNumber: 1,
};

const SESSIONS = [
  { session_id: "aaaa1111-x", harness: "codex", main_model: "glm", requests: 150, input_tokens: 10 },
  { session_id: "bbbb2222-y", harness: "pi", main_model: "glm", requests: 120, input_tokens: 30 },
  { session_id: "cccc3333-z", harness: "codex", main_model: null, requests: 20, input_tokens: 20 },
  { session_id: "dddd4444-w", harness: "codex", main_model: "deepseek", requests: 100, input_tokens: 40 },
];

const WEEKS = [
  { week: "2026-08-09", last_day: "2026-08-15", month: "2026-08", simulated: true },
  { week: "2026-08-16", last_day: "2026-08-22", month: "2026-08", simulated: true },
];

test("a URL with no table keys gives the default state", () => {
  assert.deepEqual(readTableState(new URLSearchParams("weeks=all&scope=All")), DEFAULT_STATE);
});

test("the state reads back what it wrote, and the selection's keys are untouched", () => {
  const state = {
    search: "ab12",
    harness: "codex",
    model: "glm",
    minRequests: 100,
    sort: { key: "requests", direction: "ascending" },
    pageNumber: 3,
  };
  const params = writeTableState(new URLSearchParams("weeks=2026-08-09&scope=All"), state);
  assert.equal(params.get("weeks"), "2026-08-09");
  assert.equal(params.get("scope"), "All");
  assert.equal(params.get("min_requests"), "100");
  assert.deepEqual(readTableState(params), state);
});

test("the default state writes no table key", () => {
  const params = writeTableState(new URLSearchParams("scope=All&page=4&search=x"), DEFAULT_STATE);
  assert.equal(params.toString(), "scope=All");
});

test("a page or a minimum that is not a number falls back to page 1 and no minimum", () => {
  const state = readTableState(new URLSearchParams("page=last&min_requests=many"));
  assert.equal(state.pageNumber, 1);
  assert.equal(state.minRequests, null);
});

test("an unknown sort column or direction falls back to the default sort", () => {
  const state = readTableState(new URLSearchParams("sort=secret&direction=sideways"));
  assert.deepEqual(state.sort, { key: "input_tokens", direction: "descending" });
});

test("a new selection drops the table's page and keeps its other keys", () => {
  assert.equal(withFirstPage(new URLSearchParams("weeks=all&page=3&harness=pi")).toString(), "weeks=all&harness=pi");
});

test("the default sort lists the most input first", () => {
  const ids = shownSessions(SESSIONS, DEFAULT_STATE).map((row) => row.session_id);
  assert.deepEqual(ids, ["dddd4444-w", "bbbb2222-y", "cccc3333-z", "aaaa1111-x"]);
});

test("a search by an id prefix finds the session", () => {
  const ids = shownSessions(SESSIONS, { ...DEFAULT_STATE, search: "BBBB2222" }).map((row) => row.session_id);
  assert.deepEqual(ids, ["bbbb2222-y"]);
});

test("a harness and a minimum of requests keep only that harness's sessions with at least that many", () => {
  const state = { ...DEFAULT_STATE, harness: "codex", minRequests: 100 };
  const ids = shownSessions(SESSIONS, state).map((row) => row.session_id);
  assert.deepEqual(ids, ["dddd4444-w", "aaaa1111-x"]);
});

test("a main model filter keeps that model's sessions", () => {
  const ids = shownSessions(SESSIONS, { ...DEFAULT_STATE, model: "glm" }).map((row) => row.session_id);
  assert.deepEqual(ids, ["bbbb2222-y", "aaaa1111-x"]);
});

test("a second click on the sorted column reverses it; a new column sorts numbers largest first, text A to Z", () => {
  const sort = { key: "input_tokens", direction: "descending" };
  assert.deepEqual(nextSort(sort, "input_tokens"), { key: "input_tokens", direction: "ascending" });
  assert.deepEqual(nextSort(sort, "requests"), { key: "requests", direction: "descending" });
  assert.deepEqual(nextSort(sort, "harness"), { key: "harness", direction: "ascending" });
});

test("a row opens the Session page with its week and id, and the selection", () => {
  const row = { week: "2026-08-09", session_id: "aaaa1111-x" };
  const selection = { weeks: ["2026-08-09"], scope: "All", unknownWeeks: [], unknownMonth: null };
  assert.equal(sessionLink(row, selection, WEEKS), "session.html?week=2026-08-09&id=aaaa1111-x&weeks=2026-08-09&scope=All");
});

test("a start time is written as UTC minutes", () => {
  assert.equal(startedText(Date.UTC(2026, 7, 9, 13, 5, 42)), "2026-08-09 13:05");
});

test("a session id is shortened to eight characters", () => {
  assert.equal(shortId("0123456789abcdef"), "01234567");
});

test("a session's cached share is cached over reported input, and missing with none reported", () => {
  assert.equal(withCachedShare({ cached_tokens: 3, reported_input_tokens: 4 }).cached_share, 0.75);
  assert.equal(withCachedShare({ cached_tokens: 0, reported_input_tokens: 0 }).cached_share, null);
});

test("a filter's choices are the rows' distinct values and the current one, sorted, without nulls", () => {
  assert.deepEqual(choices(SESSIONS, "main_model", ""), ["deepseek", "glm"]);
  assert.deepEqual(choices(SESSIONS, "harness", "kilo"), ["codex", "kilo", "pi"]);
});

test("the session column links each row to its Session page, as the row click does", () => {
  const selection = { weeks: ["2026-08-09"], scope: "All", unknownWeeks: [], unknownMonth: null };
  const columns = linkedColumns({ selection, weeks: WEEKS });
  const row = { week: "2026-08-09", session_id: "aaaa1111-x" };
  const sessionColumn = columns.find((column) => column.key === "session_id");
  assert.equal(sessionColumn.href(row), sessionLink(row, selection, WEEKS));
  assert.equal(columns.filter((column) => column.href !== undefined).length, 1);
});
