/**
 * The sessions table: every top-level session of the answer, searched by id, filtered by month, harness, main model
 * and a minimum of requests, sorted and paged in the browser. Its state lives in the URL
 * (`explore/sessions_table_state.js`), read back on every change. Above it, one row of form controls: the month and
 * harness drop-downs, the model drop-down, the minimum of requests and the search box. A row click opens the Session
 * page. On its default view the table draws its first page from `explore/sessions_first_page` before the full list,
 * `explore/sessions_of_selection`, has arrived, and enables its controls once it has.
 *
 * The answer holds every week's sessions of every harness, and the table filters them itself by month and harness
 * (`explore/sessions_filter.js`). It owns the keys `months` and `harnesses`: it reads them from the URL once, writes them
 * back in that form, and writes them again whenever the visitor changes the filter. A key the table does not read is
 * left as it is.
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`. This one writes its state
 * with `context.replaceQuery(params)`.
 */

import { showError, showLoading, showNote } from "../shared/charts.js";
import { readAnswer } from "../shared/answers.js";
import { queryString } from "../shared/layout.js";
import { mountTable } from "../shared/table.js";
import {
  harnessChoices, monthChoices, readTableFilter, rowsInFilter, unknownFilterNote, writeTableFilter,
} from "./sessions_filter.js";
import {
  choices, COLUMNS, firstPageCountLine, isDefaultState, isStateFiltered, nextSort, readTableState, sessionCountLine,
  shownSessions, wholeNumberOrNull, withCachedShare, withFirstPage, writeTableState,
} from "./sessions_table_state.js";

// The text of the model drop-down's first choice, which filters nothing.
const EVERY_MODEL_TEXT = "All models";

/**
 * Lay out a fresh place in `container`, load the sessions and draw the controls and the table into it, or the error
 * if the query fails. The table's filter is read and rewritten in the URL first, before the answer is loaded.
 */
export async function runSessionsTable(container, context) {
  const place = document.createElement("div");
  showLoading(place);
  container.replaceChildren(place);
  const filter = rewriteFilter(context);
  await drawSessions(place, context, filter).catch((error) => showError(place, error));
}

/**
 * The table's columns: the session column links each row to its Session page, carrying `exploreParams`, the Explore
 * page's URL keys, so the link back to its Session Explorer reopens the table as it was.
 */
export function linkedColumns(exploreParams) {
  const columns = [];
  for (const column of COLUMNS) {
    if (column.key === "session_id") {
      columns.push({ ...column, href: (row) => sessionLink(row, exploreParams) });
    } else {
      columns.push(column);
    }
  }
  return columns;
}

/**
 * The Session page's address for `row`: its week and id, then every other key of `exploreParams` (the table's
 * filters, search, sort and page). The Session page passes the keys it does not read on to its link back to the
 * Session Explorer.
 */
export function sessionLink(row, exploreParams) {
  const params = new URLSearchParams({ week: row.week, id: row.session_id });
  for (const [key, value] of exploreParams) {
    if (!params.has(key)) {
      params.append(key, value);
    }
  }
  return `session.html${queryString(params)}`;
}

// ---------- Drawing ----------
// `view` is `{ rows, tablePlace, context, filter, notePlace }`: the loaded sessions, where the table goes, the
// section's context, the month and harness filter, and where the note naming the URL's unknown months and harnesses
// goes.

/**
 * Draw the table into `place`. On the table's default view, its first page is drawn at once from the small answer of
 * the 20 newest sessions, the controls disabled; the full list follows and is drawn over it.
 */
async function drawSessions(place, context, filter) {
  const notePlace = document.createElement("div");
  notePlace.className = "table-note";
  const view = { rows: [], tablePlace: document.createElement("div"), context, filter, notePlace };
  if (filter.month === "" && filter.harness === "" && isDefaultState(currentState())) {
    drawFirstPage(place, view, await readAnswer("explore/sessions_first_page"));
  }
  const rows = await readAnswer("explore/sessions_of_selection");
  view.rows = rows.map(withCachedShare);
  place.replaceChildren(controlsRow(view), view.notePlace, view.tablePlace);
  drawUnknownNote(view);
  drawTable(view);
}

/** Draw the first page of `firstPageRows` into `place`, its count over the full list, every control disabled. */
function drawFirstPage(place, view, firstPageRows) {
  const firstPage = firstPageRows.map(withCachedShare);
  const controls = controlsRow({ ...view, rows: firstPage });
  for (const control of controls.querySelectorAll("select, input")) {
    control.disabled = true; // the choices come from the full list, which is on its way
  }
  place.replaceChildren(controls, view.notePlace, view.tablePlace);
  mountTable(view.tablePlace, {
    columns: linkedColumns(currentParams()),
    rows: firstPage,
    rowCount: firstPage.length === 0 ? 0 : firstPage[0].total_sessions,
    sort: currentState().sort,
    pageNumber: 1,
    summary: firstPageCountLine(firstPage),
    onSort: () => undefined, // the sort buttons are drawn disabled
    onPage: () => undefined,
    onRowClick: (row) => window.location.assign(sessionLink(row, currentParams())),
    isWaiting: true,
  });
}

function currentParams() {
  return new URLSearchParams(window.location.search);
}

function currentState() {
  return readTableState(currentParams());
}

/**
 * Read the URL's filter and write it back in its own form: a key naming several months or harnesses keeps the first the
 * data hold, and one naming none of them is removed; the filter read.
 */
function rewriteFilter(context) {
  const params = currentParams();
  const filter = readTableFilter(params, context.weeks, context.harnesses);
  context.replaceQuery(writeTableFilter(params, filter));
  return filter;
}

/** Write `state` to the URL and draw the table for it. */
function changeTable(view, state) {
  view.context.replaceQuery(writeTableState(currentParams(), state));
  drawTable(view);
}

/** Make `filter` the table's, write it to the URL, and draw the table, on its first page, for it. */
function changeTableFilter(view, filter) {
  view.filter = filter;
  view.context.replaceQuery(withFirstPage(writeTableFilter(currentParams(), filter)));
  drawUnknownNote(view);
  drawTable(view);
}

/** Draw the note naming what the URL named that the data do not hold, or nothing. */
function drawUnknownNote(view) {
  const unknown = unknownFilterNote(view.filter);
  if (unknown === "") {
    view.notePlace.replaceChildren();
  } else {
    showNote(view.notePlace, unknown);
  }
}

/** Apply `change`, part of a state such as `{ model }`, and go back to the first page. */
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
  const filtered = rowsInFilter(view.rows, view.filter);
  const shown = shownSessions(filtered, state);
  mountTable(view.tablePlace, {
    columns: linkedColumns(exploreParams),
    rows: shown,
    sort: state.sort,
    pageNumber: state.pageNumber,
    summary: sessionCountLine(shown, view.rows, isFiltered(view, state)),
    onSort: (key) => sortBy(view, key),
    onPage: (pageNumber) => changeTable(view, { ...currentState(), pageNumber }),
    onRowClick: (row) => window.location.assign(sessionLink(row, exploreParams)),
  });
}

/** Whether the table shows fewer than its rows: a month or harness chosen, a search, or a filter of its own. */
function isFiltered(view, state) {
  return view.filter.month !== "" || view.filter.harness !== "" || isStateFiltered(state);
}

// ---------- Controls ----------

/** The row of controls: the month and harness drop-downs, the model drop-down, the minimum and the search. */
function controlsRow(view) {
  const state = currentState();
  const row = document.createElement("div");
  row.className = "controls table-controls";
  const modelChoices = valueChoices(EVERY_MODEL_TEXT, choices(view.rows, "main_model", state.model));
  const model = choiceSelect(modelChoices, state.model);
  model.addEventListener("change", () => changeFilter(view, { model: model.value }));
  const search = textInput("search", "Session id", state.search);
  search.addEventListener("input", () => changeFilter(view, { search: search.value.trim() }));
  const minimum = textInput("number", "Any", state.minRequests ?? "");
  minimum.min = "0";
  minimum.addEventListener("input", () => changeFilter(view, { minRequests: wholeNumberOrNull(minimum.value) }));
  const searchField = labelledField("Search", search);
  searchField.classList.add("is-search");
  // In this order, two to a row on a phone: month and harness, model and minimum, then the search alone.
  row.append(...filterFields(view), labelledField("Model", model), labelledField("Min requests", minimum), searchField);
  return row;
}

/** The month and harness drop-downs; a choice names nothing unknown. */
function filterFields(view) {
  const month = choiceSelect(monthChoices(view.context.weeks), view.filter.month);
  month.addEventListener("change", () => changeTableFilter(view, { ...view.filter, month: month.value, unknown: [] }));
  const harness = choiceSelect(harnessChoices(view.context.harnesses), view.filter.harness);
  harness.addEventListener("change", () => {
    changeTableFilter(view, { ...view.filter, harness: harness.value, unknown: [] });
  });
  return [labelledField("Month", month), labelledField("Harness", harness)];
}

/** `control` under its name in small capitals, as one field of the controls row. */
function labelledField(name, control) {
  const field = document.createElement("label");
  field.className = "control-field";
  const nameElement = document.createElement("span");
  nameElement.className = "control-field-name";
  nameElement.textContent = name;
  field.append(nameElement, control);
  return field;
}

function textInput(type, placeholder, value) {
  const input = document.createElement("input");
  input.type = type;
  input.placeholder = placeholder;
  input.value = String(value);
  return input;
}

/** The choices `[{ value, text }]` of a drop-down: `everyText` for none (value ""), then each of `values` as itself. */
function valueChoices(everyText, values) {
  const options = [{ value: "", text: everyText }];
  for (const value of values) {
    options.push({ value, text: value });
  }
  return options;
}

/** A drop-down of `options`, `[{ value, text }]`, showing the one whose value is `current`. */
function choiceSelect(options, current) {
  const select = document.createElement("select");
  for (const choice of options) {
    select.append(new Option(choice.text, choice.value));
  }
  select.value = current;
  return select;
}
