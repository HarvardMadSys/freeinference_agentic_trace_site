/**
 * The Explore page: weekly trends, headline numbers, distribution cards and the sessions table of the selected weeks.
 *
 * The page draws its header, week picker and every section's loading state from `weeks.json` before DuckDB
 * loads, then opens the database, fills the selection tables and runs every section. A change of the
 * selection, from the picker or a trend bar, rewrites the URL, refills the tables and runs every section again.
 *
 * `page` is what the page owns: `{ weeks, selection, database }`, the entries of `weeks.json`, the current
 * selection and the open database (null until it opens). A section runs as `run(container, context)` with
 * `context = { database, selection, weeks, onWeekClick, replaceQuery }`, and lays out fresh places in its
 * container each time, so a run that a newer one replaced draws into places no longer on the page.
 */

import { showError, showNote } from "../shared/charts.js";
import { openDatabase } from "../shared/database.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { mountSelection, readSelection, selectionQuery, writeSelection } from "../shared/selection.js";
import { layoutDistributions, runDistributions } from "../explore/distributions.js";
import { layoutHeadline, runHeadline } from "../explore/headline.js";
import { layoutSessionsTable, runSessionsTable, withFirstPage } from "../explore/sessions_table.js";
import { layoutTrends, runTrends } from "../explore/trends.js";

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "index.html";

// The note in every section's place while no week is selected.
const NO_WEEK_NOTE = "Pick at least one week to see its numbers.";

// Each section: the id of its place in index.html, the function that draws its loading state, and the one that runs it.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "trends", layout: layoutTrends, run: runTrends }),
  Object.freeze({ id: "headline", layout: layoutHeadline, run: runHeadline }),
  Object.freeze({ id: "distributions", layout: layoutDistributions, run: runDistributions }),
  Object.freeze({ id: "sessions", layout: layoutSessionsTable, run: runSessionsTable }),
]);

start();

/** Draw everything `weeks.json` allows, then open the database and run the sections. */
async function start() {
  renderFooter(document.querySelector("#site-footer"));
  let weeks;
  try {
    weeks = await fetchWeeks();
  } catch (error) {
    renderHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams());
    showError(document.querySelector("#selection"), error);
    showErrorInEverySection(error);
    return;
  }
  const page = { weeks, selection: readSelection(new URLSearchParams(window.location.search), weeks), database: null };
  renderPageHeader(page);
  mountPicker(page);
  showUnknownChoices(page.selection);
  layoutEverySection();
  try {
    page.database = await openDatabase(new URL("data/", window.location.href).href);
  } catch (error) {
    showErrorInEverySection(error);
    return;
  }
  await runEverySection(page);
}

/** The entries of `data/weeks.json`, oldest first. */
async function fetchWeeks() {
  const response = await fetch("data/weeks.json");
  if (!response.ok) {
    throw new Error(`Could not fetch data/weeks.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/** Fill the selection tables with the page's selection, then run every section; with no week selected, show the note instead. */
async function runEverySection(page) {
  const selection = page.selection;
  if (selection.weeks.length === 0) {
    showNoteInEverySection(NO_WEEK_NOTE);
    return;
  }
  layoutEverySection();
  try {
    await page.database.setSelection(selection);
  } catch (error) {
    showErrorInEverySection(error);
    return;
  }
  // A newer selection replaced this one while its tables were filled; that selection's run draws the page.
  if (page.selection !== selection) {
    return;
  }
  const context = {
    database: page.database,
    selection,
    weeks: page.weeks,
    onWeekClick: (week) => selectWeek(page, week),
    replaceQuery,
  };
  await Promise.all(SECTIONS.map((section) => section.run(sectionElement(section), context)));
}

/** Make `selection` the page's: write it to the URL and the header's links, and run every section again. */
function changeSelection(page, selection) {
  page.selection = selection;
  // A new selection lists other sessions, so the sessions table starts again on its first page.
  replaceQuery(withFirstPage(writeSelection(new URLSearchParams(window.location.search), selection, page.weeks)));
  renderPageHeader(page);
  runEverySection(page);
}

/** Write `params` to the address bar, as `selectionQuery` writes them, without reloading the page. */
function replaceQuery(params) {
  window.history.replaceState(null, "", `${window.location.pathname}${selectionQuery(params)}`);
}

/** Select `week` alone, keeping the scope, as a click on its trend bar asks. */
function selectWeek(page, week) {
  changeSelection(page, { weeks: [week], scope: page.selection.scope, unknownWeeks: [], unknownMonth: null });
  mountPicker(page);
}

function renderPageHeader(page) {
  // The header's links carry the selection alone, not the sessions table's search and sort.
  const selectionParams = writeSelection(new URLSearchParams(), page.selection, page.weeks);
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, selectionParams);
}

function mountPicker(page) {
  const picker = document.querySelector("#selection");
  mountSelection(picker, page.weeks, page.selection, (selection) => changeSelection(page, selection));
}

/** Add to the picker a note naming the weeks and the month the URL named that `weeks.json` does not hold. */
function showUnknownChoices(selection) {
  const unknown = [...selection.unknownWeeks];
  if (selection.unknownMonth !== null) {
    unknown.push(`month ${selection.unknownMonth}`);
  }
  if (unknown.length === 0) {
    return;
  }
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = `Not in the data, so not selected: ${unknown.join(", ")}.`;
  document.querySelector("#selection").append(note);
}

function sectionElement(section) {
  return document.querySelector(`#${section.id}`);
}

function layoutEverySection() {
  for (const section of SECTIONS) {
    section.layout(sectionElement(section));
  }
}

function showNoteInEverySection(text) {
  for (const section of SECTIONS) {
    showNote(sectionElement(section), text);
  }
}

function showErrorInEverySection(error) {
  for (const section of SECTIONS) {
    showError(sectionElement(section), error);
  }
}
