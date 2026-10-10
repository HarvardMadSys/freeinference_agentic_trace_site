/**
 * The sessions table: every top-level session of the selected weeks and scope, searched by id, filtered by
 * harness, main model and a minimum of requests, sorted and paged in the browser. Its state lives in the
 * URL keys `search`, `harness`, `model`, `min_requests`, `sort`, `direction` and `page`, read back on every
 * change; the selection's keys are never touched. A row click opens the Session page.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`. This one writes its state
 * with `context.replaceQuery(params)`.
 */

import { showError, showLoading } from "../shared/charts.js";
import {
  cachedShare, formatCount, formatOptionalShare, formatSeconds, formatTokens, MISSING_TEXT, shortSessionId, utcMinute,
} from "../shared/format.js";
import { selectionQuery, writeSelection } from "../shared/selection.js";
import { filterRows, mountTable, searchRows, sortRows } from "../shared/table.js";

// The table's sort when the URL names none: most input first.
const DEFAULT_SORT = Object.freeze({ key: "input_tokens", direction: "descending" });

// The table's columns: the row key each shows, its title, how its value is written, and whether it is a number.
// The session column gets its link when the table is drawn, since the link carries the selection.
const COLUMNS = Object.freeze([
  Object.freeze({ key: "session_id", title: "Session", format: shortSessionId }),
  Object.freeze({ key: "week", title: "Week" }),
  Object.freeze({ key: "first_start_ms", title: "Started (UTC)", format: utcMinute }),
  Object.freeze({ key: "harness", title: "Harness" }),
  Object.freeze({ key: "main_model", title: "Main model", format: textOrMissing }),
  Object.freeze({ key: "requests", title: "Requests", format: formatCount, isNumber: true }),
  Object.freeze({ key: "turns", title: "Turns", format: formatCount, isNumber: true }),
  Object.freeze({ key: "subagents", title: "Subagents", format: formatCount, isNumber: true }),
  Object.freeze({ key: "tool_calls", title: "Tool calls", format: formatCount, isNumber: true }),
  Object.freeze({ key: "duration_s", title: "Duration", format: formatSeconds, isNumber: true }),
  Object.freeze({ key: "input_tokens", title: "Input tokens", format: formatTokens, isNumber: true }),
  Object.freeze({ key: "cached_share", title: "Cached share", format: formatOptionalShare, isNumber: true }),
  Object.freeze({ key: "peak_prompt_tokens", title: "Peak prompt", format: formatTokens, isNumber: true }),
]);

/** Show the loading state in `container`. */
export function layoutSessionsTable(container) {
  showLoading(container);
}

/**
 * Lay out a fresh place in `container`, load the selection's sessions and draw the controls and the table into it,
 * or the error if the query fails. A run that a newer one replaced draws into a place no longer on the page.
 */
export async function runSessionsTable(container, context) {
  const place = document.createElement("div");
  showLoading(place);
  container.replaceChildren(place);
  await drawSessions(place, context).catch((error) => showError(place, error));
}

/**
 * The table's columns for `context`: the session column links each row to its Session page, carrying
 * `exploreParams`, the Explore page's URL keys, so the link back to Explore reopens the table as it was.
 */
export function linkedColumns(context, exploreParams) {
  const columns = [];
  for (const column of COLUMNS) {
    if (column.key === "session_id") {
      columns.push({ ...column, href: (row) => sessionLink(row, exploreParams, context.selection, context.weeks) });
    } else {
      columns.push(column);
    }
  }
  return columns;
}

async function drawSessions(place, context) {
  const queryRows = await context.database.runQuery("explore/sessions_of_selection");
  const rows = queryRows.map(withCachedShare);
  const tablePlace = document.createElement("div");
  const view = { rows, tablePlace, context };
  place.replaceChildren(sectionTitle(), controlsRow(view), tablePlace);
  drawTable(view);
}

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

/** A copy of `params` without the table's page, so a new selection's table opens on its first page. */
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

/** The sort after a click on the column `key`: the same column reversed, or a new one, numbers largest first. */
export function nextSort(sort, key) {
  if (sort.key === key) {
    return { key, direction: sort.direction === "descending" ? "ascending" : "descending" };
  }
  const column = COLUMNS.find((candidate) => candidate.key === key);
  return { key, direction: column.isNumber ? "descending" : "ascending" };
}

/**
 * The Session page's address for `row`: its week and id, then every other key of `exploreParams` (the table's
 * search, filters, sort and page), then the selection's keys. The Session page passes the keys it does not read
 * on to its link back to Explore.
 */
export function sessionLink(row, exploreParams, selection, weeks) {
  const params = new URLSearchParams({ week: row.week, id: row.session_id });
  for (const [key, value] of exploreParams) {
    if (!params.has(key)) {
      params.append(key, value);
    }
  }
  return `session.html${selectionQuery(writeSelection(params, selection, weeks))}`;
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

function wholeNumberOrNull(text) {
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

// ---------- Drawing ----------
// `view` is `{ rows, tablePlace, context }`: the loaded sessions, where the table goes, and the section's context.

function currentState() {
  return readTableState(new URLSearchParams(window.location.search));
}

/** Write `state` to the URL and draw the table for it. */
function changeTable(view, state) {
  view.context.replaceQuery(writeTableState(new URLSearchParams(window.location.search), state));
  drawTable(view);
}

/** Apply `change`, part of a state such as `{ harness }`, and go back to the first page. */
function changeFilter(view, change) {
  changeTable(view, { ...currentState(), ...change, pageNumber: 1 });
}

function sortBy(view, key) {
  const state = currentState();
  changeTable(view, { ...state, sort: nextSort(state.sort, key), pageNumber: 1 });
}

function drawTable(view) {
  const exploreParams = new URLSearchParams(window.location.search);
  const state = currentState();
  const shown = shownSessions(view.rows, state);
  mountTable(view.tablePlace, {
    columns: linkedColumns(view.context, exploreParams),
    rows: shown,
    sort: state.sort,
    pageNumber: state.pageNumber,
    summary: `${formatCount(shown.length)} of ${formatCount(view.rows.length)} sessions`,
    onSort: (key) => sortBy(view, key),
    onPage: (pageNumber) => changeTable(view, { ...currentState(), pageNumber }),
    onRowClick: (row) => window.location.assign(sessionLink(row, exploreParams, view.context.selection, view.context.weeks)),
  });
}

function sectionTitle() {
  const title = document.createElement("h2");
  title.textContent = "Sessions";
  return title;
}

function controlsRow(view) {
  const state = currentState();
  const row = document.createElement("div");
  row.className = "controls";
  const search = labelledInput("search", "Session id", state.search);
  search.addEventListener("input", () => changeFilter(view, { search: search.value.trim() }));
  const harness = choiceSelect("Every harness", choices(view.rows, "harness", state.harness), state.harness);
  harness.addEventListener("change", () => changeFilter(view, { harness: harness.value }));
  const model = choiceSelect("Every main model", choices(view.rows, "main_model", state.model), state.model);
  model.addEventListener("change", () => changeFilter(view, { model: model.value }));
  const minimum = labelledInput("number", "Minimum requests", state.minRequests ?? "");
  minimum.min = "0";
  minimum.addEventListener("input", () => changeFilter(view, { minRequests: wholeNumberOrNull(minimum.value) }));
  row.append(search, harness, model, minimum);
  return row;
}

function labelledInput(type, label, value) {
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = label;
  input.setAttribute("aria-label", label);
  input.value = String(value);
  return input;
}

function choiceSelect(everyLabel, values, current) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", everyLabel);
  select.append(new Option(everyLabel, ""));
  for (const value of values) {
    select.append(new Option(value, value));
  }
  select.value = current;
  return select;
}
