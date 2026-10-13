/**
 * The sessions table's columns, its state in the URL keys `search`, `harness`, `model`, `min_requests`, `sort`,
 * `direction` and `page`, and the rows it lists for a state: those whose id contains the search and that pass every
 * filter, sorted. A state is `{ search, harness, model, minRequests, sort: { key, direction }, pageNumber }`.
 */

import {
  cachedShare, formatCount, formatOptionalShare, formatQuantity, formatSeconds, formatTokens, MISSING_TEXT, shortMinute,
  shortSessionId,
} from "../shared/format.js";
import { filterRows, searchRows, sortRows } from "../shared/table.js";

// The prefix the release gives the benchmark replay's harness, "eval:swe-bench", which the table leaves out.
const EVAL_PREFIX = /^eval:/;

// The table's sort when the URL names none: the newest session first.
const DEFAULT_SORT = Object.freeze({ key: "first_start_ms", direction: "descending" });

// The chip after the benchmark's harness, and what it says.
const BENCHMARK_MARK = Object.freeze({ text: "Benchmark", title: "A replay of SWE-bench tasks, not human-driven." });

// The table's columns: the row key each shows, its title, how its value is written, and whether it is a number; the
// harness's cell marks the benchmark replay. The first four fit a phone's width, so its requests come before its
// model. A session's week is not a column: its start gives it, and the month filter chooses by it. Its tool calls, peak
// prompt and subagents are not either: the Session page shows them, and nine columns fit a desktop card.
// The session column gets its link when the table is drawn, since the link carries the selection.
export const COLUMNS = Object.freeze([
  Object.freeze({ key: "session_id", title: "Session", format: shortSessionId }),
  Object.freeze({ key: "first_start_ms", title: "Started (UTC)", format: shortMinute }),
  Object.freeze({ key: "harness", title: "Harness", format: harnessText, mark: benchmarkMark }),
  Object.freeze({ key: "requests", title: "Requests", format: formatCount, isNumber: true }),
  Object.freeze({ key: "main_model", title: "Model", format: textOrMissing }),
  Object.freeze({ key: "turns", title: "Turns", format: formatCount, isNumber: true }),
  Object.freeze({ key: "duration_s", title: "Duration", format: formatSeconds, isNumber: true }),
  Object.freeze({ key: "input_tokens", title: "Input tokens", format: formatTokens, isNumber: true }),
  Object.freeze({ key: "cached_share", title: "Cached share", format: formatOptionalShare, isNumber: true }),
]);

/** The table's state in `params`: `{ search, harness, model, minRequests, sort: { key, direction }, pageNumber }`. */
export function readTableState(params) {
  return {
    search: params.get("search") ?? "",
    harness: params.get("harness") ?? "",
    model: params.get("model") ?? "",
    minRequests: wholeNumberOrNull(params.get("min_requests")),
    sort: readSort(params),
    pageNumber: wholeNumberOrNull(params.get("page")) ?? 1,
  };
}

/** A copy of `params` holding `state`, a key only where it differs from the default, every other key untouched. */
export function writeTableState(params, state) {
  const written = new URLSearchParams(params);
  setOrDelete(written, "search", state.search, "");
  setOrDelete(written, "harness", state.harness, "");
  setOrDelete(written, "model", state.model, "");
  setOrDelete(written, "min_requests", state.minRequests === null ? "" : String(state.minRequests), "");
  setOrDelete(written, "sort", state.sort.key, DEFAULT_SORT.key);
  setOrDelete(written, "direction", state.sort.direction, DEFAULT_SORT.direction);
  setOrDelete(written, "page", String(state.pageNumber), "1");
  return written;
}

/** A copy of `params` without the table's page, so a table with a new selection or filter opens on its first page. */
export function withFirstPage(params) {
  const written = new URLSearchParams(params);
  written.delete("page");
  return written;
}

/** The rows the table lists for `state`: those whose id contains the search and that pass every filter, sorted. */
export function shownSessions(rows, state) {
  const conditions = [];
  if (state.harness !== "") {
    conditions.push({ key: "harness", equals: state.harness });
  }
  if (state.model !== "") {
    conditions.push({ key: "main_model", equals: state.model });
  }
  if (state.minRequests !== null) {
    conditions.push({ key: "requests", atLeast: state.minRequests });
  }
  // Only the id is searched: a search over every column would match the text "null" of a missing value.
  const found = searchRows(rows, "session_id", state.search);
  return sortRows(filterRows(found, conditions), state.sort.key, state.sort.direction);
}

/**
 * The rows of `rows` whose harness is one of `harnesses`. The answer for the default selection holds every harness,
 * the benchmark's included, so a table that lists the page's selection keeps only the selected harnesses' rows.
 */
export function rowsOfHarnesses(rows, harnesses) {
  const selected = new Set(harnesses);
  return rows.filter((row) => selected.has(row.harness));
}

/** The sort after a click on the column `key`: the same column reversed, or a new one, numbers largest first. */
export function nextSort(sort, key) {
  if (sort.key === key) {
    return { key, direction: sort.direction === "descending" ? "ascending" : "descending" };
  }
  const column = COLUMNS.find((candidate) => candidate.key === key);
  return { key, direction: column.isNumber ? "descending" : "ascending" };
}

/** A copy of a session row with its cached share, null when none of its input was reported. */
export function withCachedShare(row) {
  return { ...row, cached_share: cachedShare(row.cached_tokens, row.reported_input_tokens) };
}

/** The distinct values of `row[key]` over `rows` and `current` (unless empty), sorted; nulls left out. */
export function choices(rows, key, current) {
  const values = new Set();
  for (const row of rows) {
    if (row[key] !== null) {
      values.add(row[key]);
    }
  }
  if (current !== "") {
    values.add(current);
  }
  return [...values].sort();
}

/**
 * The line over the table: with no filter, the rows `listed`, "12,002 sessions", as the stats strip counts them; else
 * the rows `shown` against them, "120 of 12,002 sessions".
 */
export function sessionCountLine(shown, listed, isFiltered) {
  if (isFiltered) {
    return `${formatCount(shown.length)} of ${formatCount(listed.length)} sessions`;
  }
  return formatQuantity(listed.length, "session", "sessions");
}

/** Whether `state` is the table's default view: no search or filter, the newest sessions first, the first page. */
export function isDefaultState(state) {
  const isDefaultSort = state.sort.key === DEFAULT_SORT.key && state.sort.direction === DEFAULT_SORT.direction;
  return !isStateFiltered(state) && isDefaultSort && state.pageNumber === 1;
}

/** The line over the first page, from `firstPageRows` (rows of `explore/sessions_first_page`): "12,002 sessions". */
export function firstPageCountLine(firstPageRows) {
  const total = firstPageRows.length === 0 ? 0 : firstPageRows[0].total_sessions;
  return formatQuantity(total, "session", "sessions");
}

/** Whether `state` searches or filters by harness, model or a minimum of requests. */
export function isStateFiltered(state) {
  return state.search !== "" || state.harness !== "" || state.model !== "" || state.minRequests !== null;
}

/** A harness as the table and its drop-down name it: the benchmark's without its "eval:" prefix, "swe-bench". */
export function harnessText(harness) {
  return harness.replace(EVAL_PREFIX, "");
}

/** The chip after the benchmark replay's harness, `{ text, title }`; null for any other session. */
export function benchmarkMark(row) {
  return row.benchmark ? BENCHMARK_MARK : null;
}

// A missing value, such as the main model of a session whose requests name none, is shown as `MISSING_TEXT`.
function textOrMissing(text) {
  return text ?? MISSING_TEXT;
}

function readSort(params) {
  const key = params.get("sort");
  const direction = params.get("direction");
  const known = COLUMNS.some((column) => column.key === key);
  return {
    key: known ? key : DEFAULT_SORT.key,
    direction: direction === "ascending" || direction === "descending" ? direction : DEFAULT_SORT.direction,
  };
}

/** The whole number `text` begins with, or null when it begins with none. */
export function wholeNumberOrNull(text) {
  const number = Number.parseInt(text ?? "", 10);
  return Number.isNaN(number) ? null : number;
}

function setOrDelete(params, key, value, defaultValue) {
  if (value === defaultValue) {
    params.delete(key);
  } else {
    params.set(key, value);
  }
}
