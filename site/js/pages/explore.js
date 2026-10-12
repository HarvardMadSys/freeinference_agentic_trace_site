/**
 * The Explore page: the hero with its stats strip, the model and harness mixes, weekly trends, the paper's figures in
 * six sections, the sessions table, and the citation and the team.
 *
 * The page draws its header, hero, figure cards and every section's loading state from `weeks.json` and
 * `harnesses.json`, then gives the database the selection and runs every section.
 *
 * Behind the switch, with `FIGURES_ARE_FROZEN` false, the page also mounts the pickers and writes the URL's selection
 * back in its shortest form; it runs every section from the precomputed answers for the default selection and in
 * DuckDB for any other. A change of the selection, from the pickers or a trend bar, rewrites the URL, gives the
 * database the new selection and runs every section again. Once the first run has drawn, the database streams the
 * weeks' rows in, and the picker's note counts the weeks streamed.
 *
 * While `FIGURES_ARE_FROZEN`, the page shows the default selection whatever the URL says: it mounts no picker, hides
 * the selection's card, answers every section from its precomputed file, draws every figure at once, takes no click
 * on a trend bar, and starts neither DuckDB nor the stream. The URL's `months` and `harnesses` then filter the sessions
 * table alone, which reads them, and the older `weeks`, `month` and `scope`, and rewrites them in its own keys.
 *
 * `page` is what the page owns: `{ weeks, harnesses, selection, database, orders, figures, latestRun, streamedWeeks }`:
 * - `weeks` and `harnesses`, the entries of `weeks.json` and `harnesses.json`;
 * - `selection`, the current selection (the default one while frozen), and `database`, the database;
 * - `orders`, the colour orders (below);
 * - `figures`, what the figure sections keep (`explore/figure_sections.js`): null until the header is drawn, then a
 *   promise of it that settles once every figure card is placed; it stays a promise, and each run awaits it;
 * - `latestRun`, the number of the latest run of the sections, so a run that a newer one replaced stops before it
 *   draws;
 * - `streamedWeeks`, the Sundays streamed in so far behind the switch (null when the page does not stream).
 * `orders` is `{ harnesses, models, categories, providers }`, the promised rows of `setup/harness_order`,
 * `setup/model_order`, `setup/category_order` and `setup/provider_order`, asked for once. A section runs as
 * `run(container, context)` with `context = { database, orders, sessionsPerWeekByHarness, selection, weeks, harnesses,
 * onWeekClick, replaceQuery, filterInTable }`, and lays out fresh places in its container each time, so a run that a
 * newer one replaced draws into places no longer on the page. `sessionsPerWeekByHarness` is the promised rows of
 * `explore/sessions_per_week_by_harness`, asked for once a run, since the harness mix and the sessions trend both draw
 * them. `filterInTable` is whether the sessions table filters its rows by month and harness itself, which it does
 * while the figures are frozen.
 */

import { showError, showNote } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, openDatabase, STREAM_ROWS_AFTER_DRAW } from "../shared/database.js";
import { mountHeader, renderFooter } from "../shared/layout.js";
import {
  defaultSelection, readSelection, selectionQuery, writeSelection,
} from "../shared/selection.js";
import {
  layoutFigures, mountFigureSections, runFigures, showErrorInFigureSections, showErrorInFigures, showNoteInFigures,
} from "../explore/figure_sections.js";
import { mountSelection, showStreamedWeeks } from "../explore/selection_pickers.js";
import { layoutSessionsTable, runSessionsTable } from "../explore/sessions_table.js";
import { withFirstPage } from "../explore/sessions_table_state.js";
import { layoutTrends, runTrends } from "../explore/trends.js";
import { layoutMixes, runMixes } from "../landing/donuts.js";
import { mountCopyButtons, renderCiteLine } from "../landing/cite.js";
import { renderHero } from "../landing/hero.js";
import { layoutStats, runStats } from "../landing/stats.js";
import { renderTeam } from "../landing/team.js";

// Whether every section and figure is frozen on its precomputed answer for every week and the paper's harnesses:
// true mounts no picker and starts neither DuckDB nor the stream; false lets the visitor pick weeks and harnesses, and
// the browser computes every section for them.
export const FIGURES_ARE_FROZEN = true;

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "index.html";

// The notes in every section's place while no week, or no harness, is selected.
const NO_WEEK_NOTE = "Pick at least one week to see its numbers.";
const NO_HARNESS_NOTE = "Pick at least one harness to see its numbers.";

// Each section: the id of its place in index.html, the function that draws its loading state, and the one that runs it.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "stats", layout: layoutStats, run: runStats }),
  Object.freeze({ id: "mixes", layout: layoutMixes, run: runMixes }),
  Object.freeze({ id: "trends", layout: layoutTrends, run: runTrends }),
  Object.freeze({ id: "sessions-table", layout: layoutSessionsTable, run: runSessionsTable }),
]);

start();

/** Draw everything `weeks.json` and `harnesses.json` allow, then run the sections. */
async function start() {
  renderFooter(document.querySelector("#site-footer"), PAGE_FILE, new URLSearchParams());
  renderTeam(document.querySelector("#team"));
  renderCiteLine(document.querySelector("#cite-line"));
  mountCopyButtons(document, navigator.clipboard);
  // Frozen, the selection's card is hidden; with the pickers, it shows the selection the figures draw instead.
  document.querySelector("#selection").hidden = FIGURES_ARE_FROZEN;
  let weeks;
  let harnesses;
  try {
    [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  } catch (error) {
    mountHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams());
    renderHero(document.querySelector("#hero"), null);
    // Every section shows the error in its own place; the hidden card shows nothing.
    showErrorInEverySection(error);
    showErrorInFigureSections(error);
    return;
  }
  renderHero(document.querySelector("#hero"), weeks.length);
  const params = new URLSearchParams(window.location.search);
  const selection = FIGURES_ARE_FROZEN ? defaultSelection(weeks, harnesses) : readSelection(params, weeks, harnesses);
  const dataUrl = new URL("data/", window.location.href).href;
  const database = openDatabase(dataUrl, weeks, harnesses, { answersOnly: FIGURES_ARE_FROZEN });
  // The orders cover every week and harness, so they do not change with the selection; a section awaits its own.
  const orders = {
    harnesses: database.runQuery("setup/harness_order"),
    models: database.runQuery("setup/model_order"),
    categories: database.runQuery("setup/category_order"),
    providers: database.runQuery("setup/provider_order"),
  };
  for (const order of Object.values(orders)) {
    // With nothing selected no section awaits the orders; a failure is shown by the sections that do, not here.
    order.catch(() => undefined);
  }
  const streamedWeeks = STREAM_ROWS_AFTER_DRAW ? [] : null;
  const page = { weeks, harnesses, selection, database, orders, figures: null, latestRun: 0, streamedWeeks };
  showSelectionAndHeader(page, params);
  // The pickers are drawn first; the figure modules load and their cards are placed after.
  page.figures = mountFigureSections(FIGURES_ARE_FROZEN);
  await runEverySection(page);
  scrollToAnchor();
  if (!FIGURES_ARE_FROZEN) {
    await database.streamRows((progress) => showStreamed(page, progress.streamedWeeks));
  }
}

/**
 * Write the URL's selection back in its shortest form, which draws the header, and mount the pickers; while the
 * figures are frozen, draw the header alone: the sessions table rewrites the URL's keys, which are its own.
 */
function showSelectionAndHeader(page, params) {
  if (FIGURES_ARE_FROZEN) {
    renderPageHeader();
    return;
  }
  // A key that says the default, or names no known week, goes.
  replaceQuery(writeSelection(params, page.selection, page.weeks, page.harnesses));
  mountPicker(page);
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
  const sessionsPerWeekByHarness = page.database.runQuery("explore/sessions_per_week_by_harness");
  // Each section that awaits the rows shows a failure in its own place, not here.
  sessionsPerWeekByHarness.catch(() => undefined);
  const context = {
    database: page.database,
    orders: page.orders,
    sessionsPerWeekByHarness,
    selection,
    weeks: page.weeks,
    harnesses: page.harnesses,
    // Frozen, the selection never changes, so a trend bar takes no click.
    onWeekClick: FIGURES_ARE_FROZEN ? null : (week) => selectWeek(page, week),
    replaceQuery,
    filterInTable: FIGURES_ARE_FROZEN,
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
  // The brand's link carries every key of the URL, the sessions table's included, as the Session page's links do: a
  // visitor who follows it finds the table as it was.
  mountHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams(window.location.search));
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
