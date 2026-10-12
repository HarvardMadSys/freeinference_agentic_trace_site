/**
 * The sessions table: every top-level session of the answer, searched by id, filtered by month, harness, main model
 * and a minimum of requests, sorted and paged in the browser. Its state lives in the URL
 * (`explore/sessions_table_state.js`), read back on every change. Above it, one row of form controls: the month and
 * harness drop-downs, the model drop-down, the minimum of requests and the search box, and under them what a month
 * holds. A row click opens the Session page.
 *
 * While `context.filterInTable`, there is no selection to choose: the answer holds every week's sessions of every
 * harness and the table filters them itself by month and harness (`explore/sessions_filter.js`). It then owns the keys
 * `months` and `harnesses`: it reads them, and the older `weeks`, `month`, `scope` and `harness`, from the URL once,
 * rewrites them in its own keys, and keeps the filter while the visitor changes it. While the page's pickers choose
 * the selection instead, the table never touches the selection's keys, has no month drop-down, and its harness
 * drop-down chooses among the selected harnesses.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`. This one writes its state
 * with `context.replaceQuery(params)`.
 */

import { showError, showLoading } from "../shared/charts.js";
import { selectionQuery, writeSelection } from "../shared/selection.js";
import { mountTable } from "../shared/table.js";
import { note } from "./selection_pickers.js";
import {
  EVERY_HARNESS_TEXT, harnessChoices, monthChoices, readTableFilter, rowsInFilter, unknownFilterNote, writeTableFilter,
} from "./sessions_filter.js";
import {
  choices, COLUMNS, isStateFiltered, nextSort, readTableState, rowsOfHarnesses, sessionCountLine, shownSessions,
  wholeNumberOrNull, withCachedShare, withFirstPage, writeTableState,
} from "./sessions_table_state.js";

// The text of the model drop-down's first choice, which filters nothing.
const EVERY_MODEL_TEXT = "All models";

// The line under the controls of the table that filters itself by month: what a month holds.
const MONTH_NOTE = "A month holds the weeks whose Sunday falls in it.";

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

/**
 * The Session page's address for `row`: its week and id, then every other key of `exploreParams` (the table's
 * filters, search, sort and page), then the keys of `context.selection`, written against `context.weeks` and
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
// `view` is `{ rows, tablePlace, context, filter, notePlace }`: the loaded sessions, where the table goes, the
// section's context, the month and harness filter (null unless the table filters itself), and where the note naming
// the URL's unknown months and harnesses goes.

async function drawSessions(place, context, filter) {
  const queryRows = await context.database.runQuery("explore/sessions_of_selection");
  // The table that filters itself lists every harness; otherwise it lists the page's selected harnesses alone.
  const listed = filter === null ? rowsOfHarnesses(queryRows, context.selection.harnesses) : queryRows;
  const view = {
    rows: listed.map(withCachedShare),
    tablePlace: document.createElement("div"),
    context,
    filter,
    notePlace: document.createElement("div"),
  };
  view.notePlace.className = "table-note";
  place.replaceChildren(controlsRow(view), ...monthNote(filter), view.notePlace, view.tablePlace);
  drawUnknownNote(view);
  drawTable(view);
}

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
  const unknown = view.filter === null ? "" : unknownFilterNote(view.filter);
  view.notePlace.replaceChildren(...(unknown === "" ? [] : [note(unknown)]));
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
  const filtered = view.filter === null ? view.rows : rowsInFilter(view.rows, view.filter, view.context.weeks);
  const shown = shownSessions(filtered, state);
  mountTable(view.tablePlace, {
    columns: linkedColumns(view.context, exploreParams),
    rows: shown,
    sort: state.sort,
    pageNumber: state.pageNumber,
    summary: sessionCountLine(shown, view.rows, isFiltered(view, state)),
    onSort: (key) => sortBy(view, key),
    onPage: (pageNumber) => changeTable(view, { ...currentState(), pageNumber }),
    onRowClick: (row) => window.location.assign(sessionLink(row, exploreParams, view.context)),
  });
}

/** Whether the table shows fewer than its rows: a search, a filter of its own, or a month or harness chosen. */
function isFiltered(view, state) {
  const isMonthOrHarnessChosen = view.filter !== null && (view.filter.month !== "" || view.filter.harness !== "");
  return isMonthOrHarnessChosen || isStateFiltered(state);
}

// ---------- Controls ----------

/** The row of controls: the month and harness drop-downs, the model drop-down, the minimum and the search. */
function controlsRow(view) {
  const state = currentState();
  const row = document.createElement("div");
  row.className = "controls table-controls";
  const harnessFields = view.filter === null ? [selectedHarnessField(view, state)] : filterFields(view);
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
  row.append(...harnessFields, labelledField("Model", model), labelledField("Min requests", minimum), searchField);
  return row;
}

/** The line saying what a month holds, under the controls of the table that filters itself; none otherwise. */
function monthNote(filter) {
  if (filter === null) {
    return [];
  }
  const line = document.createElement("p");
  line.className = "table-month-note";
  line.textContent = MONTH_NOTE;
  return [line];
}

/** The month and harness drop-downs of the table that filters itself; a choice names nothing unknown. */
function filterFields(view) {
  const month = choiceSelect(monthChoices(view.context.weeks), view.filter.month);
  month.addEventListener("change", () => changeTableFilter(view, { ...view.filter, month: month.value, unknown: [] }));
  const harness = choiceSelect(harnessChoices(view.context.harnesses), view.filter.harness);
  harness.addEventListener("change", () => {
    changeTableFilter(view, { ...view.filter, harness: harness.value, unknown: [] });
  });
  return [labelledField("Month", month), labelledField("Harness", harness)];
}

/** The harness drop-down of the table that lists the page's selection: one of the harnesses its rows hold. */
function selectedHarnessField(view, state) {
  const harnessValues = valueChoices(EVERY_HARNESS_TEXT, choices(view.rows, "harness", state.harness));
  const harness = choiceSelect(harnessValues, state.harness);
  harness.addEventListener("change", () => changeFilter(view, { harness: harness.value }));
  return labelledField("Harness", harness);
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
