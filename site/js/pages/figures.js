/**
 * The Paper figures page: the paper's figures, drawn for the selected weeks and harnesses.
 *
 * Every figure gets a card in its section's grid. The default selection's figures are drawn from the precomputed
 * answers; any other selection's are computed in DuckDB. A selection change rewrites the URL, gives the database the
 * new selection and redraws every figure, without reloading the page. Figures run concurrently, and each shows its
 * own loading state, error or note; a run that a newer selection has replaced is dropped.
 */

import { assignColours, MIN_ROWS_PER_BIN, renderFigure, showError, showLoading, showNote, weeksText } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, openDatabase } from "../shared/database.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { readSelection, selectionQuery, writeSelection } from "../shared/selection.js";
import { mountSelection } from "../explore/selection_pickers.js";
import { drawnHarnessesAndWeeks, dropThinGroups, hiddenText, restingCountText } from "../figures/figure_rows.js";

// Each section of the page: the element its figures go in, and the module listing them. Every section module
// exports its figures as `FIGURES`, so each is imported by its path rather than under a second name.
const SECTIONS = Object.freeze([
  Object.freeze({ selector: "#figures-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#figures-tools", module: "../figures/tools.js" }),
  Object.freeze({ selector: "#figures-caching", module: "../figures/caching.js" }),
]);

const PAGE_FILE = "figures.html"; // the page's own file, which the header marks as active
const DATA_FOLDER = "data/"; // the data files, relative to the page

const NO_WEEK_NOTE = "Pick at least one week to draw this figure.";
const NO_HARNESS_NOTE = "Pick at least one harness to draw this figure.";
const NO_ROWS_NOTE = "No rows for this selection.";
const ALL_THIN_NOTE = `Too few rows: every bin of this selection has fewer than ${MIN_ROWS_PER_BIN} rows.`;

startPage().catch((error) => showError(document.querySelector("#selection"), error));

/**
 * Draw the header, the pickers and every figure's card, write the URL's selection back in its shortest form, and draw
 * the figures of that selection.
 */
async function startPage() {
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams());
  renderFooter(document.querySelector("#site-footer"));
  const [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  const selection = readSelection(new URLSearchParams(window.location.search), weeks, harnesses);
  // What the page owns: the weeks and harnesses, every figure with its card, the database with the colours every
  // figure shares, and the number of the latest run.
  const opening = openWithColours(weeks, harnesses);
  const page = { weeks, harnesses, cards: await placeCards(), opening, latestRun: 0 };
  writeSelectionToPage(page, selection);
  const picker = document.querySelector("#selection");
  mountSelection(picker, weeks, harnesses, selection, (chosen) => changeSelection(page, chosen));
  await drawSelection(page, selection);
}

/** Write `selection` into the URL and the header's links, then redraw every figure for it. */
function changeSelection(page, selection) {
  writeSelectionToPage(page, selection);
  return drawSelection(page, selection);
}

/** Write `selection` into the URL, keeping its other keys, and into the header's links. */
function writeSelectionToPage(page, selection) {
  const params = writeSelection(new URLSearchParams(window.location.search), selection, page.weeks, page.harnesses);
  window.history.replaceState(null, "", `${window.location.pathname}${selectionQuery(params)}`);
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, params);
}

/** Draw every figure for `selection`: a note everywhere when no week is selected, else each figure's query and chart. */
async function drawSelection(page, selection) {
  page.latestRun += 1;
  const run = { number: page.latestRun, selection };
  const bodies = page.cards.map(({ figure, card }) => renderFigure(card, { ...figure, caption: "" }));
  if (selection.weeks.length === 0 || selection.harnesses.length === 0) {
    const note = selection.weeks.length === 0 ? NO_WEEK_NOTE : NO_HARNESS_NOTE;
    bodies.forEach((body) => showNote(body, note));
    return;
  }
  bodies.forEach((body) => showLoading(body));
  let opened;
  try {
    opened = await page.opening;
    await opened.database.setSelection(selection);
  } catch (error) {
    if (run.number === page.latestRun) {
      bodies.forEach((body) => showError(body, error)); // a newer selection's run shows its own state instead
    }
    return;
  }
  if (run.number !== page.latestRun) {
    return; // a newer selection has replaced this run before its queries started
  }
  const drawings = page.cards.map((placed, index) => drawFigure(page, opened, placed, bodies[index], run));
  await Promise.all(drawings);
}

/** Run one figure's query and draw its rows into `body`, with its caption; its error stays in its own card. */
async function drawFigure(page, { database, colours }, { figure, card }, body, run) {
  try {
    const rows = await database.runQuery(figure.query);
    if (run.number !== page.latestRun) {
      return; // a newer selection has replaced this run; its own run draws the figure
    }
    const { rows: shown, hidden } = dropThinGroups(rows, figure.binColumn);
    writeCaption(card, figure, shown, hidden, drawnHarnessesAndWeeks(figure, run.selection, page.weeks, page.harnesses));
    if (rows.length === 0) {
      showNote(body, NO_ROWS_NOTE);
    } else if (shown.length === 0) {
      showNote(body, ALL_THIN_NOTE);
    } else {
      await figure.draw(shown, body, colours);
    }
  } catch (error) {
    if (run.number === page.latestRun) {
      showError(body, error);
    }
  }
}

/** Write a figure's caption: the rows it rests on, the harnesses and weeks they come from, and how many bins were hidden. */
function writeCaption(card, figure, shownRows, hidden, { harnesses, weeks }) {
  const parts = [restingCountText(shownRows, figure), harnesses, weeksText(weeks)];
  const hiddenNote = hiddenText(hidden, figure.binColumn);
  if (hiddenNote !== "") {
    parts.push(hiddenNote);
  }
  card.querySelector(".figure-caption").textContent = parts.join(" · ");
}

/** Every figure of every section, each with a new card in its section's grid: `[{ figure, card }]`. */
async function placeCards() {
  const cards = [];
  for (const section of SECTIONS) {
    const { FIGURES } = await import(section.module);
    const grid = document.querySelector(`${section.selector} .card-grid`);
    for (const figure of FIGURES) {
      const card = document.createElement("article");
      card.className = "card";
      card.id = figure.name;
      card.classList.toggle("is-wide", figure.isWide === true); // a wide table takes the grid's whole width
      grid.append(card);
      cards.push({ figure, card });
    }
  }
  return cards;
}

/** The database over the data folder's files of `weeks`, and the colours every figure shares: `{ database, colours }`. */
async function openWithColours(weeks, harnesses) {
  const database = openDatabase(new URL(DATA_FOLDER, window.location.href).href, weeks, harnesses);
  const models = await database.runQuery("setup/model_order");
  const categories = await database.runQuery("setup/category_order");
  const colours = Object.freeze({
    models: assignColours(models.map((row) => row.model)),
    categories: assignColours(categories.map((row) => row.category)),
  });
  return { database, colours };
}
