/**
 * The Explore page's start: it draws the header, the footer, the Insights' topic tabs and every section's loading state,
 * reads `weeks.json` and `harnesses.json`, then runs the page's sections and the figures of `FIGURE_SECTIONS`
 * (`explore/figure_sections.js`), once, from their answer files. The figures are shown one topic at a time behind the
 * tabs of the `#topic-tabs` row (`explore/topic_tabs.js`), a topic's figures drawn when it is shown.
 *
 * The page's module names its sections, each `{ id, layout, run }`: the id of its place in `index.html`, the function
 * that draws its loading state and the one that runs it. A section runs as `run(container, context)` with
 * `context = { orders, sessionsPerWeekByHarness, weeks, harnesses, replaceQuery }`:
 * - `orders`, `{ harnesses, models, categories, providers }`, the promised rows of `setup/harness_order`,
 *   `setup/model_order`, `setup/category_order` and `setup/provider_order`, asked for once;
 * - `sessionsPerWeekByHarness`, the promised rows of `explore/sessions_per_week_by_harness`, asked for once, since the
 *   harness mix and the sessions trend both draw them;
 * - `weeks` and `harnesses`, the entries of `weeks.json` and `harnesses.json`;
 * - `replaceQuery(params)`, which writes `params` to the address bar and the header's links; the sessions table keeps
 *   its filter, search, sort and page there.
 */

import { showError } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, runQuery } from "../shared/database.js";
import { EXPLORE_FILE, mountHeader, renderFooter, selectionQuery } from "../shared/layout.js";
import {
  FIGURE_SECTIONS, layoutFigures, mountFigureSections, runFigures, showErrorInFigures, startFigures,
} from "./figure_sections.js";
import { mountTopicTabs } from "./topic_tabs.js";

/**
 * Start the Explore page: draw its header, footer and topic tabs, its `sections` and its figures, and, once
 * `weeks.json` is read, call `showWeekCount` with the number of weeks, or with null when the indexes cannot be read.
 * Settles once the sections have drawn.
 */
export async function startPage({ sections, showWeekCount }) {
  renderFooter(document.querySelector("#site-footer"), EXPLORE_FILE, new URLSearchParams(), null);
  // The figure modules load and the tabs are drawn while the indexes are read, so a tab shows its topic at once.
  const figures = mountFigureSections();
  mountTabs(figures);
  let weeks;
  let harnesses;
  try {
    [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  } catch (error) {
    mountHeader(document.querySelector("#site-header"), EXPLORE_FILE, new URLSearchParams());
    showWeekCount(null);
    // Every section and figure shows the error in its own place.
    showErrorInEverySection(sections, error);
    showErrorInFigures(await figures, error);
    return;
  }
  // The footer counts the weeks as the hero does.
  renderFooter(document.querySelector("#site-footer"), EXPLORE_FILE, new URLSearchParams(), weeks.length);
  showWeekCount(weeks.length);
  renderPageHeader();
  const context = sectionContext(weeks, harnesses);
  await runEverySection(sections, await figures, context);
  scrollToAnchor();
}

/** What every section is given; see the module's comment. */
function sectionContext(weeks, harnesses) {
  // The orders cover every week and harness; a section awaits its own.
  const orders = {
    harnesses: askedRows("setup/harness_order"),
    models: askedRows("setup/model_order"),
    categories: askedRows("setup/category_order"),
    providers: askedRows("setup/provider_order"),
  };
  const sessionsPerWeekByHarness = askedRows("explore/sessions_per_week_by_harness");
  return { orders, sessionsPerWeekByHarness, weeks, harnesses, replaceQuery };
}

/** The promised rows of the query `name`, asked for once for every section that reads them. */
function askedRows(name) {
  const rows = runQuery(name);
  // Each section that awaits the rows shows a failure in its own place, not here.
  rows.catch(() => undefined);
  return rows;
}

/** Lay out every section and figure, each loading, then run them all. */
async function runEverySection(sections, figures, context) {
  layoutEverySection(sections);
  layoutFigures(figures);
  const sectionRuns = sections.map((section) => section.run(sectionElement(section), context));
  await Promise.all([...sectionRuns, runFigures(figures, context)]);
}

/**
 * Show the topic the URL's anchor names, or the first, behind the tabs of the `#topic-tabs` row; showing a topic starts
 * the figures of it, once `figures`, the promise of what the figure sections keep, settles. Before the run there is
 * none to start, and the run starts the shown topic's figures itself.
 */
function mountTabs(figures) {
  // The promise never rejects: a figure module that fails to load shows its error in its own section.
  mountTopicTabs(document.querySelector("#topic-tabs"), FIGURE_SECTIONS, () => figures.then(startFigures));
}

/**
 * Bring the section the URL's anchor names, such as `#cite`, into view: the browser looked for it while the sections
 * were still empty, so the page was too short to scroll to it. The anchor of a topic brings the section holding the
 * topics into view, so that the heading and the tabs above the topic are seen.
 */
function scrollToAnchor() {
  const target = document.getElementById(window.location.hash.slice(1));
  if (window.location.hash === "" || target === null) {
    return;
  }
  const isTopic = FIGURE_SECTIONS.some((section) => section.selector === window.location.hash);
  const scrolled = isTopic ? target.parentElement : target;
  scrolled.scrollIntoView();
}

/**
 * Write `params` to the address bar, as `selectionQuery` writes them, keeping its anchor, without reloading the page;
 * then redraw the header, whose links carry them.
 */
function replaceQuery(params) {
  const { pathname, hash } = window.location;
  // The entry keeps its state, the Insights' shown topic, which Back to it shows again.
  window.history.replaceState(window.history.state, "", `${pathname}${selectionQuery(params)}${hash}`);
  renderPageHeader();
}

function renderPageHeader() {
  // The header is given every key of the URL, the sessions table's included, as the Session page's links are: a
  // visitor who follows its link to the table finds the table as it was.
  mountHeader(document.querySelector("#site-header"), EXPLORE_FILE, new URLSearchParams(window.location.search));
}

function sectionElement(section) {
  return document.querySelector(`#${section.id}`);
}

function layoutEverySection(sections) {
  for (const section of sections) {
    section.layout(sectionElement(section));
  }
}

function showErrorInEverySection(sections, error) {
  for (const section of sections) {
    showError(sectionElement(section), error);
  }
}
