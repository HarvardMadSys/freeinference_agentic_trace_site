/**
 * The Explore page's start: it draws the page's header, footer and every section's loading state from
 * `weeks.json` and `harnesses.json`, then gives the database the selection and runs the page's sections.
 *
 * A page names its sections (`{ id, layout, run }`, the id of its place in the page's HTML, the function that draws its
 * loading state and the one that runs it) and, when it draws figures, its figure sections (`FIGURE_SECTIONS` of
 * `explore/figure_sections.js`, or a part of it), shown one topic at a time behind the tabs of its `#topic-tabs` row
 * (`explore/topic_tabs.js`), a topic's figures drawn when it is shown. A section that reads the answer of sessions per
 * week by harness says so with `readsSessionsPerWeek`, so that only a page with such a section asks for it.
 *
 * Behind the switch, with `FIGURES_ARE_FROZEN` false, a page also mounts the pickers into its `#selection` card, when
 * its HTML has one, and writes the URL's selection back in its shortest form; it runs its sections from the
 * precomputed answers for the default selection and in DuckDB for any other. A change of the selection, from the
 * pickers or a trend bar, rewrites the URL, gives the database the new selection and runs the sections again. Once the
 * first run has drawn, the database streams the weeks' rows in, and the picker's note counts the weeks streamed.
 *
 * While `FIGURES_ARE_FROZEN`, a page shows the default selection whatever the URL says: it mounts no picker, hides the
 * selection's card, answers every section from its precomputed file, draws a shown topic's figures at once, takes no
 * click on a trend bar, and starts neither DuckDB nor the stream. The URL's `months` and `harnesses` then filter the sessions
 * table alone, which reads them, and the older `weeks`, `month` and `scope`, and rewrites them in its own keys.
 *
 * `page` is what the page owns: `{ file, sections, weeks, harnesses, selection, database, orders, figures, latestRun,
 * streamedWeeks }`:
 * - `file`, the page's own file, which the header marks; `sections`, its sections;
 * - `weeks` and `harnesses`, the entries of `weeks.json` and `harnesses.json`;
 * - `selection`, the current selection (the default one while frozen), and `database`, the database;
 * - `orders`, the colour orders (below);
 * - `figures`, what the figure sections keep (`explore/figure_sections.js`), none on a page without figures: null
 *   until the header is drawn, then a promise of it that settles once every figure card is placed; it stays a
 *   promise, and each run awaits it;
 * - `latestRun`, the number of the latest run of the sections, so a run that a newer one replaced stops before it
 *   draws;
 * - `streamedWeeks`, the Sundays streamed in so far behind the switch (null when the page does not stream).
 * `orders` is `{ harnesses, models, categories, providers }`, the promised rows of `setup/harness_order`,
 * `setup/model_order`, `setup/category_order` and `setup/provider_order`, asked for once. A section runs as
 * `run(container, context)` with `context = { database, orders, sessionsPerWeekByHarness, selection, weeks, harnesses,
 * onWeekClick, replaceQuery, filterInTable }`, and lays out fresh places in its container each time, so a run that a
 * newer one replaced draws into places no longer on the page. `sessionsPerWeekByHarness` is the promised rows of
 * `explore/sessions_per_week_by_harness`, asked for once a run on a page with a section that reads them (null on any
 * other), since the harness mix and the sessions trend both draw them. `filterInTable` is whether the sessions table
 * filters its rows by month and harness itself, which it does while the figures are frozen.
 */

import { showError, showNote } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, openDatabase, STREAM_ROWS_AFTER_DRAW } from "../shared/database.js";
import { mountHeader, renderFooter } from "../shared/layout.js";
import { defaultSelection, readSelection, selectionQuery, writeSelection } from "../shared/selection.js";
import {
  layoutFigures, mountFigureSections, runFigures, showErrorInFigureSections, showErrorInFigures, showNoteInFigures,
  startFigures,
} from "./figure_sections.js";
import { mountSelection, showStreamedWeeks } from "./selection_pickers.js";
import { withFirstPage } from "./sessions_table_state.js";
import { mountTopicTabs } from "./topic_tabs.js";

// Whether every section and figure is frozen on its precomputed answer for every week and the paper's harnesses:
// true mounts no picker and starts neither DuckDB nor the stream; false lets the visitor pick weeks and harnesses, and
// the browser computes every section for them.
export const FIGURES_ARE_FROZEN = true;

// The notes in every section's place while no week, or no harness, is selected.
const NO_WEEK_NOTE = "Pick at least one week to see its numbers.";
const NO_HARNESS_NOTE = "Pick at least one harness to see its numbers.";

/**
 * Start the Explore page whose file is `file`: draw its header and footer, its `sections` and its `figureSections`
 * (none by default). Settles once the first run of the sections has drawn.
 */
export async function startPage({ file, sections, figureSections = [] }) {
  renderFooter(document.querySelector("#site-footer"), file, new URLSearchParams());
  const selectionCard = document.querySelector("#selection");
  if (selectionCard !== null) {
    // Frozen, the selection's card is hidden; with the pickers, it shows the selection the figures draw instead.
    selectionCard.hidden = FIGURES_ARE_FROZEN;
  }
  let weeks;
  let harnesses;
  try {
    [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  } catch (error) {
    mountHeader(document.querySelector("#site-header"), file, new URLSearchParams());
    // Every section shows the error in its own place; the hidden card shows nothing.
    showErrorInEverySection(sections, error);
    showErrorInFigureSections(figureSections, error);
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const page = openPage(file, sections, weeks, harnesses, params);
  showSelectionAndHeader(page, params);
  // The pickers are drawn first; the figure modules load and their cards are placed after.
  page.figures = mountFigureSections(figureSections, FIGURES_ARE_FROZEN);
  mountTabs(page, figureSections);
  await runEverySection(page);
  scrollToAnchor(figureSections);
  if (!FIGURES_ARE_FROZEN) {
    await page.database.streamRows((progress) => showStreamed(page, progress.streamedWeeks));
  }
}

/** The page's state for `weeks` and `harnesses`: its selection, its database and the colour orders asked for. */
function openPage(file, sections, weeks, harnesses, params) {
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
  return { file, sections, weeks, harnesses, selection, database, orders, figures: null, latestRun: 0, streamedWeeks };
}

/**
 * Write the URL's selection back in its shortest form, which draws the header, and mount the pickers; while the
 * figures are frozen, draw the header alone: the sessions table rewrites the URL's keys, which are its own.
 */
function showSelectionAndHeader(page, params) {
  if (FIGURES_ARE_FROZEN) {
    renderPageHeader(page);
    return;
  }
  // A key that says the default, or names no known week, goes.
  replaceQuery(page, writeSelection(params, page.selection, page.weeks, page.harnesses));
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
    showNoteInEverySection(page.sections, note);
    showNoteInFigures(figures, note);
    return;
  }
  layoutEverySection(page.sections);
  layoutFigures(figures);
  try {
    await page.database.setSelection(selection);
  } catch (error) {
    if (run === page.latestRun) {
      // A newer selection's run shows its own state instead.
      showErrorInEverySection(page.sections, error);
      showErrorInFigures(figures, error);
    }
    return;
  }
  // A newer selection replaced this one while its tables were filled; that selection's run draws the page.
  if (run !== page.latestRun) {
    return;
  }
  const context = sectionContext(page);
  const sectionRuns = page.sections.map((section) => section.run(sectionElement(section), context));
  await Promise.all([...sectionRuns, runFigures(figures, context)]);
}

/** What every section of a run is given; see the module's comment. */
function sectionContext(page) {
  return {
    database: page.database,
    orders: page.orders,
    sessionsPerWeekByHarness: askSessionsPerWeek(page),
    selection: page.selection,
    weeks: page.weeks,
    harnesses: page.harnesses,
    // Frozen, the selection never changes, so a trend bar takes no click.
    onWeekClick: FIGURES_ARE_FROZEN ? null : (week) => selectWeek(page, week),
    replaceQuery: (params) => replaceQuery(page, params),
    filterInTable: FIGURES_ARE_FROZEN,
  };
}

/** The promised rows of `explore/sessions_per_week_by_harness` when a section of the page reads them, else null. */
function askSessionsPerWeek(page) {
  if (!page.sections.some((section) => section.readsSessionsPerWeek === true)) {
    return null;
  }
  const rows = page.database.runQuery("explore/sessions_per_week_by_harness");
  // Each section that awaits the rows shows a failure in its own place, not here.
  rows.catch(() => undefined);
  return rows;
}

/**
 * Show the topic of `figureSections` the URL's anchor names, or the first, behind the tabs of the page's `#topic-tabs`
 * row, when it has one; showing a topic starts the current run's figures of it.
 */
function mountTabs(page, figureSections) {
  const row = document.querySelector("#topic-tabs");
  if (row !== null) {
    mountTopicTabs(row, figureSections, () => page.figures.then(startFigures));
  }
}

/**
 * Bring the section the URL's anchor names, such as `#cite`, into view: the browser looked for it while the sections
 * were still empty, so the page was too short to scroll to it. The anchor of a topic of `figureSections` brings the
 * section holding the topics into view, so that the heading and the tabs above the topic are seen.
 */
function scrollToAnchor(figureSections) {
  const target = document.getElementById(window.location.hash.slice(1));
  if (window.location.hash === "" || target === null) {
    return;
  }
  const isTopic = figureSections.some((section) => section.selector === window.location.hash);
  const scrolled = isTopic ? target.parentElement : target;
  scrolled.scrollIntoView();
}

/** Make `selection` the page's: write it to the URL and the header's links, and run every section again. */
function changeSelection(page, selection) {
  page.selection = selection;
  // A new selection lists other sessions, so the sessions table starts again on its first page.
  const params = writeSelection(new URLSearchParams(window.location.search), selection, page.weeks, page.harnesses);
  replaceQuery(page, withFirstPage(params));
  runEverySection(page);
}

/**
 * Write `params` to the address bar, as `selectionQuery` writes them, keeping its anchor, without reloading the page;
 * then redraw the header, whose links carry them.
 */
function replaceQuery(page, params) {
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", `${pathname}${selectionQuery(params)}${hash}`);
  renderPageHeader(page);
}

/** Select `week` alone, keeping the harnesses, as a click on its trend bar asks. */
function selectWeek(page, week) {
  const harnesses = page.selection.harnesses;
  changeSelection(page, { weeks: [week], harnesses, unknownWeeks: [], unknownMonth: null, unknownHarnesses: [] });
  mountPicker(page);
}

function renderPageHeader(page) {
  // The header is given every key of the URL, the sessions table's included, as the Session page's links are: a
  // visitor who follows its link to the table finds the table as it was.
  mountHeader(document.querySelector("#site-header"), page.file, new URLSearchParams(window.location.search));
}

/** Mount the pickers into the page's selection card; a page without one mounts none. */
function mountPicker(page) {
  const picker = document.querySelector("#selection");
  if (picker === null) {
    return;
  }
  const onChange = (selection) => changeSelection(page, selection);
  mountSelection(picker, page.weeks, page.harnesses, page.selection, onChange, () => page.streamedWeeks);
}

/** Keep `streamedWeeks`, the Sundays streamed in so far, and rewrite the picker's count of them. */
function showStreamed(page, streamedWeeks) {
  page.streamedWeeks = streamedWeeks;
  const picker = document.querySelector("#selection");
  if (picker !== null) {
    showStreamedWeeks(picker, streamedWeeks, page.weeks);
  }
}

function sectionElement(section) {
  return document.querySelector(`#${section.id}`);
}

function layoutEverySection(sections) {
  for (const section of sections) {
    section.layout(sectionElement(section));
  }
}

function showNoteInEverySection(sections, text) {
  for (const section of sections) {
    showNote(sectionElement(section), text);
  }
}

function showErrorInEverySection(sections, error) {
  for (const section of sections) {
    showError(sectionElement(section), error);
  }
}
