/**
 * The Explore page: weekly trends, headline numbers, distribution cards, the paper's figures in three sections, and
 * the sessions table of the selected weeks and harnesses.
 *
 * The page draws its header, pickers, figure cards and every section's loading state from `weeks.json` and
 * `harnesses.json`, writing the URL's selection back in its shortest form, then gives the database the selection and
 * runs every section: from the precomputed answers for the default selection, in DuckDB for any other. A change of the
 * selection, from the pickers or a trend bar, rewrites the URL, gives the database the new selection and runs every
 * section again. Once the first run has drawn, the database streams the weeks' rows in, and the picker's note counts
 * the weeks streamed.
 *
 * `page` is what the page owns: `{ weeks, harnesses, selection, database, orders, figures, latestRun, streamedWeeks }`:
 * - `weeks` and `harnesses`, the entries of `weeks.json` and `harnesses.json`;
 * - `selection`, the current selection, and `database`, the database;
 * - `orders`, the colour orders (below);
 * - `figures`, what the figure sections keep (`explore/figure_sections.js`): null until the pickers are drawn, then a
 *   promise of it that settles once every figure card is placed; it stays a promise, and each run awaits it;
 * - `latestRun`, the number of the latest run of the sections, so a run that a newer one replaced stops before it
 *   draws;
 * - `streamedWeeks`, the Sundays streamed in so far (null when the page does not stream).
 * `orders` is `{ harnesses, models, categories }`, the promised rows of `setup/harness_order`, `setup/model_order` and
 * `setup/category_order`, asked for once. A section runs as `run(container, context)` with
 * `context = { database, orders, selection, weeks, harnesses, onWeekClick, replaceQuery }`, and lays out fresh places
 * in its container each time, so a run that a newer one replaced draws into places no longer on the page.
 */

import { showError, showNote } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, openDatabase, STREAM_ROWS_AFTER_DRAW } from "../shared/database.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { readSelection, selectionQuery, writeSelection } from "../shared/selection.js";
import { layoutDistributions, runDistributions } from "../explore/distributions.js";
import {
  layoutFigures, mountFigureSections, runFigures, showErrorInFigureSections, showErrorInFigures, showNoteInFigures,
} from "../explore/figure_sections.js";
import { layoutHeadline, runHeadline } from "../explore/headline.js";
import { mountSelection, showStreamedWeeks } from "../explore/selection_pickers.js";
import { layoutSessionsTable, runSessionsTable, withFirstPage } from "../explore/sessions_table.js";
import { layoutTrends, runTrends } from "../explore/trends.js";

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "index.html";

// The notes in every section's place while no week, or no harness, is selected.
const NO_WEEK_NOTE = "Pick at least one week to see its numbers.";
const NO_HARNESS_NOTE = "Pick at least one harness to see its numbers.";

// Each section: the id of its place in index.html, the function that draws its loading state, and the one that runs it.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "trends", layout: layoutTrends, run: runTrends }),
  Object.freeze({ id: "headline", layout: layoutHeadline, run: runHeadline }),
  Object.freeze({ id: "distributions", layout: layoutDistributions, run: runDistributions }),
  Object.freeze({ id: "sessions", layout: layoutSessionsTable, run: runSessionsTable }),
]);

start();

/** Draw everything `weeks.json` and `harnesses.json` allow, then run the sections. */
async function start() {
  renderFooter(document.querySelector("#site-footer"));
  let weeks;
  let harnesses;
  try {
    [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  } catch (error) {
    renderHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams());
    showError(document.querySelector("#selection"), error);
    showErrorInEverySection(error);
    showErrorInFigureSections(error);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const selection = readSelection(params, weeks, harnesses);
  const database = openDatabase(new URL("data/", window.location.href).href, weeks, harnesses);
  // The orders cover every week and harness, so they do not change with the selection; a section awaits its own.
  const orders = {
    harnesses: database.runQuery("setup/harness_order"),
    models: database.runQuery("setup/model_order"),
    categories: database.runQuery("setup/category_order"),
  };
  for (const order of Object.values(orders)) {
    // With nothing selected no section awaits the orders; a failure is shown by the sections that do, not here.
    order.catch(() => undefined);
  }
  const streamedWeeks = STREAM_ROWS_AFTER_DRAW ? [] : null;
  const page = { weeks, harnesses, selection, database, orders, figures: null, latestRun: 0, streamedWeeks };
  // The URL is written back in its shortest form: a key that says the default, or names no known week, goes.
  replaceQuery(writeSelection(params, selection, weeks, harnesses));
  mountPicker(page);
  // The pickers are drawn first; the figure modules load and their cards are placed after.
  page.figures = mountFigureSections();
  await runEverySection(page);
  scrollToAnchor();
  await database.streamRows((progress) => showStreamed(page, progress.streamedWeeks));
}

/**
 * Give the database the page's selection, then run every section; with no week or no harness selected, show the note
 * instead.
 */
async function runEverySection(page) {
  page.latestRun += 1;
  const run = page.latestRun;
  const selection = page.selection;
  const figures = await page.figures;
  if (selection.weeks.length === 0 || selection.harnesses.length === 0) {
    const note = selection.weeks.length === 0 ? NO_WEEK_NOTE : NO_HARNESS_NOTE;
    showNoteInEverySection(note);
    showNoteInFigures(figures, note);
    return;
  }
  layoutEverySection();
  layoutFigures(figures);
  try {
    await page.database.setSelection(selection);
  } catch (error) {
    if (run === page.latestRun) {
      // A newer selection's run shows its own state instead.
      showErrorInEverySection(error);
      showErrorInFigures(figures, error);
    }
    return;
  }
  // A newer selection replaced this one while its tables were filled; that selection's run draws the page.
  if (run !== page.latestRun) {
    return;
  }
  const context = {
    database: page.database,
    orders: page.orders,
    selection,
    weeks: page.weeks,
    harnesses: page.harnesses,
    onWeekClick: (week) => selectWeek(page, week),
    replaceQuery,
  };
  const sectionRuns = SECTIONS.map((section) => section.run(sectionElement(section), context));
  await Promise.all([...sectionRuns, runFigures(figures, context)]);
}

/**
 * Bring the section the URL's anchor names, such as `#sessions`, into view: the browser looked for it while the
 * sections were still empty, so the page was too short to scroll to it.
 */
function scrollToAnchor() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (window.location.hash !== "" && target !== null) {
    target.scrollIntoView();
  }
}

/** Make `selection` the page's: write it to the URL and the header's links, and run every section again. */
function changeSelection(page, selection) {
  page.selection = selection;
  // A new selection lists other sessions, so the sessions table starts again on its first page.
  const params = writeSelection(new URLSearchParams(window.location.search), selection, page.weeks, page.harnesses);
  replaceQuery(withFirstPage(params));
  runEverySection(page);
}

/**
 * Write `params` to the address bar, as `selectionQuery` writes them, keeping its anchor, without reloading the page;
 * then redraw the header, whose links carry them.
 */
function replaceQuery(params) {
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", `${pathname}${selectionQuery(params)}${hash}`);
  renderPageHeader();
}

/** Select `week` alone, keeping the harnesses, as a click on its trend bar asks. */
function selectWeek(page, week) {
  const harnesses = page.selection.harnesses;
  changeSelection(page, { weeks: [week], harnesses, unknownWeeks: [], unknownMonth: null, unknownHarnesses: [] });
  mountPicker(page);
}

function renderPageHeader() {
  // The header's links carry every key of the URL, the sessions table's included, as the Session page's do: a visitor
  // who follows Explore or About and comes back finds the table as it was.
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams(window.location.search));
}

function mountPicker(page) {
  const picker = document.querySelector("#selection");
  const onChange = (selection) => changeSelection(page, selection);
  mountSelection(picker, page.weeks, page.harnesses, page.selection, onChange, () => page.streamedWeeks);
}

/** Keep `streamedWeeks`, the Sundays streamed in so far, and rewrite the picker's count of them. */
function showStreamed(page, streamedWeeks) {
  page.streamedWeeks = streamedWeeks;
  showStreamedWeeks(document.querySelector("#selection"), streamedWeeks, page.weeks);
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
