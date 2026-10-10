/**
 * The Paper figures page: the paper's figures, drawn for the selected weeks and scope.
 *
 * Every figure gets a card in its section's grid. A selection change rewrites the URL, refills the selection
 * tables and redraws every figure, without reloading the page. Figures run concurrently, and each shows its own
 * loading state, error or note; a run that a newer selection has replaced is dropped.
 */

import { assignColours, MIN_ROWS_PER_BIN, renderFigure, showError, showLoading, showNote, weeksText } from "../shared/charts.js";
import { openDatabase } from "../shared/database.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { mountSelection, readSelection, selectionQuery, writeSelection } from "../shared/selection.js";
import { dropThinGroups, hiddenText, restingCountText } from "../figures/figure_rows.js";

// Each section of the page: the element its figures go in, and the module listing them. Every section module
// exports its figures as `FIGURES`, so each is imported by its path rather than under a second name.
const SECTIONS = Object.freeze([
  Object.freeze({ selector: "#figures-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#figures-tools", module: "../figures/tools.js" }),
]);

const PAGE_FILE = "figures.html"; // the page's own file, which the header marks as active
const DATA_FOLDER = "data/"; // the data files, relative to the page
const WEEKS_FILE = "data/weeks.json"; // the weeks the data hold, read before DuckDB is opened

const EMPTY_SELECTION_NOTE = "Pick at least one week to draw this figure.";
const NO_ROWS_NOTE = "No rows for this selection.";
const ALL_THIN_NOTE = `Too few rows: every bin of this selection has fewer than ${MIN_ROWS_PER_BIN} rows.`;

startPage().catch((error) => showError(document.querySelector("#selection"), error));

/** Draw the header, the picker and every figure's card, open the database, and draw the figures of the URL's selection. */
async function startPage() {
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, new URLSearchParams(window.location.search));
  renderFooter(document.querySelector("#site-footer"));
  const weeks = await fetchWeeks();
  const selection = readSelection(new URLSearchParams(window.location.search), weeks);
  // What the page owns: the weeks, every figure with its card, the open database, and the number of the latest run.
  const page = { weeks, cards: await placeCards(), opening: openWithColours(), latestRun: 0 };
  const picker = document.querySelector("#selection");
  mountSelection(picker, weeks, selection, (chosen) => changeSelection(page, chosen));
  showUnknownWeeks(picker, selection);
  await drawSelection(page, selection);
}

/** Write `selection` into the URL and the header's links, then redraw every figure for it. */
function changeSelection(page, selection) {
  const params = writeSelection(new URLSearchParams(window.location.search), selection, page.weeks);
  window.history.replaceState(null, "", `${window.location.pathname}${selectionQuery(params)}`);
  renderHeader(document.querySelector("#site-header"), PAGE_FILE, params);
  return drawSelection(page, selection);
}

/** Draw every figure for `selection`: a note everywhere when no week is selected, else each figure's query and chart. */
async function drawSelection(page, selection) {
  page.latestRun += 1;
  const run = { number: page.latestRun, selection };
  const bodies = page.cards.map(({ figure, card }) => renderFigure(card, { ...figure, caption: "" }));
  if (selection.weeks.length === 0) {
    bodies.forEach((body) => showNote(body, EMPTY_SELECTION_NOTE));
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
    writeCaption(card, figure, shown, hidden, run.selection);
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

/** Write a figure's caption: the rows it rests on, the scope and the weeks, and how many bins were hidden. */
function writeCaption(card, figure, shownRows, hidden, selection) {
  const parts = [restingCountText(shownRows, figure), selection.scope, weeksText(selection.weeks)];
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

/** The database over the data folder, and the colours every figure shares: `{ database, colours }`. */
async function openWithColours() {
  const database = await openDatabase(new URL(DATA_FOLDER, window.location.href).href);
  const models = await database.runQuery("setup/model_order");
  const categories = await database.runQuery("setup/category_order");
  const colours = Object.freeze({
    models: assignColours(models.map((row) => row.model)),
    categories: assignColours(categories.map((row) => row.category)),
  });
  return { database, colours };
}

/** Add to the picker a note naming the weeks or the month the URL asked for that the data do not hold. */
function showUnknownWeeks(picker, selection) {
  const unknown = [...selection.unknownWeeks];
  if (selection.unknownMonth !== null) {
    unknown.push(selection.unknownMonth);
  }
  if (unknown.length > 0) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = `The data hold no week for ${unknown.join(", ")}; showing the weeks ticked above.`;
    picker.append(note);
  }
}

/** The weeks of `data/weeks.json`, oldest first. */
async function fetchWeeks() {
  const response = await fetch(WEEKS_FILE);
  if (!response.ok) {
    throw new Error(`Could not fetch ${WEEKS_FILE}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
