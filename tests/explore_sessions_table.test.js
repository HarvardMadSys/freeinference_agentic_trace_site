import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { linkedColumns, sessionLink } from "../site/js/explore/sessions_table.js";
import { ROWS_PER_PAGE } from "../site/js/shared/table.js";
import {
  benchmarkMark,
  choices,
  COLUMNS,
  firstPageCountLine,
  harnessText,
  isDefaultState,
  isStateFiltered,
  nextSort,
  readTableState,
  sessionCountLine,
  shownSessions,
  withCachedShare,
  withFirstPage,
  writeTableState,
} from "../site/js/explore/sessions_table_state.js";
import { tableParameters } from "../site/js/session/address.js";
import { queryString } from "../site/js/shared/layout.js";

const DEFAULT_STATE = {
  search: "",
  model: "",
  minRequests: null,
  sort: { key: "first_start_ms", direction: "descending" },
  pageNumber: 1,
};

const SESSIONS = [
  { session_id: "aaaa1111-x", harness: "codex", main_model: "glm", requests: 150, first_start_ms: 1000 },
  { session_id: "bbbb2222-y", harness: "pi", main_model: "glm", requests: 120, first_start_ms: 3000 },
  { session_id: "cccc3333-z", harness: "codex", main_model: null, requests: 20, first_start_ms: 2000 },
  { session_id: "dddd4444-w", harness: "codex", main_model: "deepseek", requests: 100, first_start_ms: 4000 },
];

test("a URL with no table keys gives the default state", () => {
  assert.deepEqual(readTableState(new URLSearchParams("months=2026-08&harnesses=codex")), DEFAULT_STATE);
});

test("the state reads back what it wrote, and the filter's keys are untouched", () => {
  const state = {
    search: "ab12",
    model: "glm",
    minRequests: 100,
    sort: { key: "requests", direction: "ascending" },
    pageNumber: 3,
  };
  const params = writeTableState(new URLSearchParams("months=2026-08&harnesses=codex"), state);
  assert.equal(params.get("months"), "2026-08");
  assert.equal(params.get("harnesses"), "codex");
  assert.equal(params.get("min_requests"), "100");
  assert.deepEqual(readTableState(params), state);
});

test("the default state writes no table key", () => {
  const params = writeTableState(new URLSearchParams("harnesses=codex&page=4&search=x"), DEFAULT_STATE);
  assert.equal(params.toString(), "harnesses=codex");
});

test("a page or a minimum that is not a number falls back to page 1 and no minimum", () => {
  const state = readTableState(new URLSearchParams("page=last&min_requests=many"));
  assert.equal(state.pageNumber, 1);
  assert.equal(state.minRequests, null);
});

test("an unknown sort column or direction falls back to the default sort", () => {
  const state = readTableState(new URLSearchParams("sort=secret&direction=sideways"));
  assert.deepEqual(state.sort, { key: "first_start_ms", direction: "descending" });
});

test("a new filter drops the table's page and keeps its other keys", () => {
  const params = new URLSearchParams("months=2026-08&page=3&harnesses=pi");
  assert.equal(withFirstPage(params).toString(), "months=2026-08&harnesses=pi");
});

test("the default sort lists the newest session first, and writes no sort key", () => {
  const ids = shownSessions(SESSIONS, DEFAULT_STATE).map((row) => row.session_id);
  assert.deepEqual(ids, ["dddd4444-w", "bbbb2222-y", "cccc3333-z", "aaaa1111-x"]);
  assert.equal(writeTableState(new URLSearchParams(), DEFAULT_STATE).toString(), "");
});

test("an explicit sort in the URL is still read", () => {
  const state = readTableState(new URLSearchParams("sort=input_tokens&direction=ascending"));
  assert.deepEqual(state.sort, { key: "input_tokens", direction: "ascending" });
});

test("the columns are the session, its start, harness and requests, which fit a phone, then the model and four numbers", () => {
  const titles = COLUMNS.map((column) => column.title);
  const expected = [
    "Session", "Started (UTC)", "Harness", "Requests", "Model", "Turns", "Duration", "Input tokens", "Cached share",
  ];
  assert.deepEqual(titles, expected);
});

test("a search by an id prefix finds the session", () => {
  const ids = shownSessions(SESSIONS, { ...DEFAULT_STATE, search: "BBBB2222" }).map((row) => row.session_id);
  assert.deepEqual(ids, ["bbbb2222-y"]);
});

test("a minimum of requests keeps only the sessions with at least that many", () => {
  const state = { ...DEFAULT_STATE, minRequests: 120 };
  const ids = shownSessions(SESSIONS, state).map((row) => row.session_id);
  assert.deepEqual(ids, ["bbbb2222-y", "aaaa1111-x"]);
});

test("a main model filter keeps that model's sessions", () => {
  const ids = shownSessions(SESSIONS, { ...DEFAULT_STATE, model: "glm" }).map((row) => row.session_id);
  assert.deepEqual(ids, ["bbbb2222-y", "aaaa1111-x"]);
});

test("a main model and a minimum of requests together keep the sessions that pass both", () => {
  const state = { ...DEFAULT_STATE, model: "glm", minRequests: 130 };
  const ids = shownSessions(SESSIONS, state).map((row) => row.session_id);
  assert.deepEqual(ids, ["aaaa1111-x"]);
});

test("a second click on the sorted column reverses it; a new column sorts numbers largest first, text A to Z", () => {
  const sort = { key: "input_tokens", direction: "descending" };
  assert.deepEqual(nextSort(sort, "input_tokens"), { key: "input_tokens", direction: "ascending" });
  assert.deepEqual(nextSort(sort, "requests"), { key: "requests", direction: "descending" });
  assert.deepEqual(nextSort(sort, "harness"), { key: "harness", direction: "ascending" });
});

test("a row opens the Session page with its week and id", () => {
  const row = { week: "2026-08-09", session_id: "aaaa1111-x" };
  assert.equal(sessionLink(row, new URLSearchParams()), "session.html?week=2026-08-09&id=aaaa1111-x");
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
  const exploreParams = new URLSearchParams("page=2");
  const columns = linkedColumns(exploreParams);
  const row = { week: "2026-08-09", session_id: "aaaa1111-x" };
  const sessionColumn = columns.find((column) => column.key === "session_id");
  assert.equal(sessionColumn.href(row), sessionLink(row, exploreParams));
  assert.equal(columns.filter((column) => column.href !== undefined).length, 1);
});

test("a row's link carries the Session Explorer page's keys as they are", () => {
  const row = { week: "2026-07-05", session_id: "aaaa1111-x" };
  const exploreParams = new URLSearchParams("months=2026-07&harnesses=codex&sort=requests&page=2");
  const link = sessionLink(row, exploreParams);
  assert.equal(link, "session.html?week=2026-07-05&id=aaaa1111-x&months=2026-07&harnesses=codex&sort=requests&page=2");
});

test("the Session page's link back carries the table's filters, search, sort and page as they were", () => {
  const row = { week: "2026-07-05", session_id: "aaaa1111-x" };
  const exploreQuery = "months=2026-07&harnesses=eval:swe-bench&search=aa&sort=requests&direction=ascending&page=2";
  const link = sessionLink(row, new URLSearchParams(exploreQuery));
  const sessionParams = new URLSearchParams(link.slice(link.indexOf("?")));
  const backQuery = queryString(tableParameters(sessionParams));
  assert.equal(backQuery, "?months=2026-07&harnesses=eval%3Aswe-bench&search=aa&sort=requests&direction=ascending&page=2");
});

test("the benchmark's harness is named without its prefix and marked with a chip that explains it", () => {
  assert.equal(harnessText("eval:swe-bench"), "swe-bench");
  assert.equal(harnessText("codex"), "codex");
  assert.deepEqual(benchmarkMark({ benchmark: true }), {
    text: "Benchmark", title: "A replay of SWE-bench tasks, not human-driven.",
  });
  assert.equal(benchmarkMark({ benchmark: false }), null);
});

test("the count line counts every listed session, the benchmark's too, and the shown against them under a filter", () => {
  const listed = [
    { session_id: "aaaa", benchmark: false },
    { session_id: "bbbb", benchmark: true },
    { session_id: "cccc", benchmark: false },
  ];
  assert.equal(sessionCountLine(listed, listed, false), "3 sessions");
  assert.equal(sessionCountLine([], listed.slice(0, 1), false), "1 session");
  assert.equal(sessionCountLine(listed.slice(0, 2), listed, true), "2 of 3 sessions");
});

test("a state with a search, a model or a minimum is filtered; the default is not", () => {
  assert.equal(isStateFiltered(DEFAULT_STATE), false);
  assert.equal(isStateFiltered({ ...DEFAULT_STATE, search: "ab" }), true);
  assert.equal(isStateFiltered({ ...DEFAULT_STATE, minRequests: 0 }), true);
  assert.equal(isStateFiltered({ ...DEFAULT_STATE, sort: { key: "requests", direction: "ascending" } }), false);
});

test("the default view is no search, no filter, the newest first and the first page; anything else is not", () => {
  assert.equal(isDefaultState(readTableState(new URLSearchParams(""))), true);
  assert.equal(isDefaultState(readTableState(new URLSearchParams("page=1"))), true);
  for (const query of ["page=2", "sort=requests", "direction=ascending", "search=ab", "model=glm", "min_requests=5"]) {
    assert.equal(isDefaultState(readTableState(new URLSearchParams(query))), false, query);
  }
});

test("the first page's count line reads the full list's count its rows carry", () => {
  assert.equal(firstPageCountLine([{ total_sessions: 12002 }, { total_sessions: 12002 }]), "12,002 sessions");
  assert.equal(firstPageCountLine([]), "0 sessions");
});

test("the first page's answer holds one page of the table", () => {
  const query = readFileSync(new URL("../site/queries/explore/sessions_first_page.sql", import.meta.url), "utf8");
  assert.match(query, new RegExp(`\\bLIMIT ${ROWS_PER_PAGE};`));
});
