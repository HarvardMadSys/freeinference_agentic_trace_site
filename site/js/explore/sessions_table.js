/**
 * The sessions table: every top-level session of the answer, searched by id, filtered by harness, main model and a
 * minimum of requests, sorted and paged in the browser. Its state lives in the URL (`explore/sessions_table_state.js`),
 * read back on every change. A row click opens the Session page.
 *
 * While the page's pickers choose the selection, the table never touches the selection's keys. While
 * `context.filterInTable`, there is no selection to choose: the answer holds every week's sessions of every harness
 * and the table filters them itself by month and harness (`explore/sessions_filter.js`). It then owns the keys
 * `months` and `harnesses`: it reads them, and the older `weeks`, `month`, `scope` and `harness`, from the URL once,
 * rewrites them in its own keys, keeps the filter while the visitor changes it, and draws its controls in a folded
 * disclosure, whose pills stand in for the one-harness choice.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`. This one writes its state
 * with `context.replaceQuery(params)`.
 */

import { showError, showLoading } from "../shared/charts.js";
import { formatCount } from "../shared/format.js";
import { selectionQuery, writeSelection } from "../shared/selection.js";
import { mountTable } from "../shared/table.js";
import { note } from "./selection_pickers.js";
import {
  filterDisclosure, filterWords, mountFilterPickers, namesFilter, readTableFilter, rowsInFilter, unknownFilterNote,
  writeTableFilter,
} from "./sessions_filter.js";
import {
  choices, COLUMNS, nextSort, readTableState, shownSessions, wholeNumberOrNull, withCachedShare, withFirstPage,
  writeTableState,
} from "./sessions_table_state.js";

/** Show the loading state in `container`. */
export function layoutSessionsTable(container) {
  showLoading(container);
}

/**
 * Lay out a fresh place in `container`, load the selection's sessions and draw the controls and the table into it,
 * or the error if the query fails. A run that a newer one replaced draws into a place no longer on the page. While
 * the table filters itself, its filter is read and rewritten in the URL first, before the answer is loaded.
 */
export async function runSessionsTable(container, context) {
  const place = document.createElement("div");
  showLoading(place);
  container.replaceChildren(place);
  const filter = context.filterInTable ? rewriteFilter(context) : null;
  await drawSessions(place, context, filter).catch((error) => showError(place, error));
}

/**
 * The table's columns for `context`: the session column links each row to its Session page, carrying
 * `exploreParams`, the Explore page's URL keys, so the link back to Explore reopens the table as it was.
 */
export function linkedColumns(context, exploreParams) {
  const columns = [];
  for (const column of COLUMNS) {
    if (column.key === "session_id") {
      columns.push({ ...column, href: (row) => sessionLink(row, exploreParams, context) });
    } else {
      columns.push(column);
    }
  }
  return columns;
}

async function drawSessions(place, context, filter) {
  const queryRows = await context.database.runQuery("explore/sessions_of_selection");
  const rows = queryRows.map(withCachedShare);
  const tablePlace = document.createElement("div");
  const view = { rows, tablePlace, context, filter, disclosure: null, notePlace: document.createElement("div") };
  if (filter === null) {
    place.replaceChildren(controlsRow(view), tablePlace);
  } else {
    view.disclosure = filterDisclosure(namesFilter(currentParams()), controlsRow(view));
    view.notePlace.className = "table-filter-note";
    place.replaceChildren(view.disclosure.element, view.notePlace, tablePlace);
    drawFilterPickers(view);
  }
  drawTable(view);
}

/**
 * The Session page's address for `row`: its week and id, then every other key of `exploreParams` (the table's
 * search, filters, sort and page), then the keys of `context.selection`, written against `context.weeks` and
 * `context.harnesses`; while `context.filterInTable`, the Explore page's keys are the table's alone and pass as they
 * are. The Session page passes the keys it does not read on to its link back to Explore.
 */
export function sessionLink(row, exploreParams, context) {
  const params = new URLSearchParams({ week: row.week, id: row.session_id });
  for (const [key, value] of exploreParams) {
    if (!params.has(key)) {
      params.append(key, value);
    }
  }
  if (context.filterInTable) {
    return `session.html${selectionQuery(params)}`;
  }
  return `session.html${selectionQuery(writeSelection(params, context.selection, context.weeks, context.harnesses))}`;
}

// ---------- Drawing ----------
// `view` is `{ rows, tablePlace, context, filter, disclosure, notePlace }`: the loaded sessions, where the table goes,
// the section's context, the month and harness filter (null unless the table filters itself), the folded filter
// (`filterDisclosure` of `explore/sessions_filter.js`, null with no filter), and where the unknown names' note goes.

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function currentState() {
  return readTableState(currentParams());
}

/** Read the URL's filter, older keys included, and write it back in its own keys; the filter read. */
function rewriteFilter(context) {
  const params = currentParams();
  const filter = readTableFilter(params, context.weeks, context.harnesses);
  context.replaceQuery(writeTableFilter(params, filter, context.weeks, context.harnesses));
  return filter;
}

/** Write `state` to the URL and draw the table for it. */
function changeTable(view, state) {
  view.context.replaceQuery(writeTableState(currentParams(), state));
  drawTable(view);
}

/** Make `filter` the table's, write it to the URL, and draw the pills and the table, on its first page, for it. */
function changeTableFilter(view, filter) {
  view.filter = filter;
  const params = writeTableFilter(currentParams(), filter, view.context.weeks, view.context.harnesses);
  view.context.replaceQuery(withFirstPage(params));
  drawFilterPickers(view);
  drawTable(view);
}

/** Draw the pills for the table's filter, and the note naming what the URL named that the data do not hold. */
function drawFilterPickers(view) {
  const onChange = (filter) => changeTableFilter(view, filter);
  mountFilterPickers(view.disclosure.pickers, view.filter, view.context.weeks, view.context.harnesses, onChange);
  // A changed filter names nothing unknown, so the note goes once the visitor changes it.
  const unknown = unknownFilterNote(view.filter);
  view.notePlace.replaceChildren(...(unknown === "" ? [] : [note(unknown)]));
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
  const exploreParams = currentParams();
  const state = currentState();
  const filtered = view.filter === null ? view.rows : rowsInFilter(view.rows, view.filter, view.context.weeks);
  const shown = shownSessions(filtered, state);
  if (view.disclosure !== null) {
    const { weeks, harnesses } = view.context;
    const line = { filter: view.filter, state, matching: shown.length, total: view.rows.length, weeks, harnesses };
    view.disclosure.line.textContent = filterWords(line);
  }
  mountTable(view.tablePlace, {
    columns: linkedColumns(view.context, exploreParams),
    rows: shown,
    sort: state.sort,
    pageNumber: state.pageNumber,
    // The folded filter's line already counts the sessions listed.
    summary: view.disclosure === null ? `${formatCount(shown.length)} of ${formatCount(view.rows.length)} sessions` : "",
    onSort: (key) => sortBy(view, key),
    onPage: (pageNumber) => changeTable(view, { ...currentState(), pageNumber }),
    onRowClick: (row) => window.location.assign(sessionLink(row, exploreParams, view.context)),
  });
}

function controlsRow(view) {
  const state = currentState();
  const row = document.createElement("div");
  row.className = "controls";
  const search = labelledInput("search", "Session id", state.search);
  search.addEventListener("input", () => changeFilter(view, { search: search.value.trim() }));
  const model = choiceSelect("Every main model", choices(view.rows, "main_model", state.model), state.model);
  model.addEventListener("change", () => changeFilter(view, { model: model.value }));
  const minimum = labelledInput("number", "Minimum requests", state.minRequests ?? "");
  minimum.min = "0";
  minimum.addEventListener("input", () => changeFilter(view, { minRequests: wholeNumberOrNull(minimum.value) }));
  // The table that filters itself chooses harnesses with its pills instead.
  const harnesses = view.filter === null ? [harnessSelect(view, state)] : [];
  row.append(search, ...harnesses, model, minimum);
  return row;
}

function harnessSelect(view, state) {
  const harness = choiceSelect("Every harness", choices(view.rows, "harness", state.harness), state.harness);
  harness.addEventListener("change", () => changeFilter(view, { harness: harness.value }));
  return harness;
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
