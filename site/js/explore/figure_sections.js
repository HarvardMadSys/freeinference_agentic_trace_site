/**
 * The figure sections of the Explore page: the Sessions, Tools and Prefix-caching figures, each a card in its
 * section's grid, drawn for the selected weeks and harnesses, its thin bins hidden and its caption written.
 *
 * `figures` is what the page keeps of them: `{ cards, places }`, every figure with its card (`[{ figure, card }]`),
 * and the places of the latest layout by figure name (`{ body, caption }`). Each layout makes fresh places, so a run
 * that a newer one replaced draws into places no longer on the page. A run's `context` is what the page gives every
 * section; see `pages/explore.js`. Each figure shows its own loading state, error or note.
 */

import { assignColours, MIN_ROWS_PER_BIN, renderFigure, showError, showLoading, showNote, weeksText } from "../shared/charts.js";
import { drawnHarnessesAndWeeks, dropThinGroups, hiddenText, restingCountText } from "../figures/figure_rows.js";

// Each figure section of the page: the element its figures go in, and the module listing them. Every section module
// exports its figures as `FIGURES`, so each is imported by its path rather than under a second name.
const SECTIONS = Object.freeze([
  Object.freeze({ selector: "#figures-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#figures-tools", module: "../figures/tools.js" }),
  Object.freeze({ selector: "#figures-caching", module: "../figures/caching.js" }),
]);

const NO_ROWS_NOTE = "No rows for this selection.";
const ALL_THIN_NOTE = `Too few rows: every bin of this selection has fewer than ${MIN_ROWS_PER_BIN} rows.`;

/** Place a card for every figure of every section; return what the page keeps of the figures, nothing laid out yet. */
export async function mountFigureSections() {
  return { cards: await placeCards(), places: new Map() };
}

/** Lay out every figure afresh, each loading. */
export function layoutFigures(figures) {
  for (const { body } of layOutPlaces(figures).values()) {
    showLoading(body);
  }
}

/** Lay out every figure afresh, each showing the note `text`. */
export function showNoteInFigures(figures, text) {
  for (const { body } of layOutPlaces(figures).values()) {
    showNote(body, text);
  }
}

/** Lay out every figure afresh, each showing `error`. */
export function showErrorInFigures(figures, error) {
  for (const { body } of layOutPlaces(figures).values()) {
    showError(body, error);
  }
}

/** Draw every figure for `context`'s selection into the places of the latest layout. */
export async function runFigures(figures, context) {
  const drawings = figures.cards.map(({ figure }) => drawFigure(figure, figures.places.get(figure.name), context));
  await Promise.all(drawings);
}

/** The colours every figure shares, `{ models, categories }`, each a Map from name to colour, from the colour orders. */
export async function figureColours(orders) {
  const models = await orders.models;
  const categories = await orders.categories;
  return Object.freeze({
    models: assignColours(models.map((row) => row.model)),
    categories: assignColours(categories.map((row) => row.category)),
  });
}

/** Run one figure's query and draw its rows into `place`, with its caption; its error stays in its own card. */
async function drawFigure(figure, place, context) {
  try {
    const colours = await figureColours(context.orders);
    const rows = await context.database.runQuery(figure.query);
    const { rows: shown, hidden } = dropThinGroups(rows, figure.binColumn);
    const drawn = drawnHarnessesAndWeeks(figure, context.selection, context.weeks, context.harnesses);
    place.caption.textContent = captionText(figure, shown, hidden, drawn);
    if (rows.length === 0) {
      showNote(place.body, NO_ROWS_NOTE);
    } else if (shown.length === 0) {
      showNote(place.body, ALL_THIN_NOTE);
    } else {
      await figure.draw(shown, place.body, colours);
    }
  } catch (error) {
    showError(place.body, error);
  }
}

/** A figure's caption: the rows it rests on, the harnesses and weeks they come from, and how many bins were hidden. */
function captionText(figure, shownRows, hidden, { harnesses, weeks }) {
  const parts = [restingCountText(shownRows, figure), harnesses, weeksText(weeks)];
  const hiddenNote = hiddenText(hidden, figure.binColumn);
  if (hiddenNote !== "") {
    parts.push(hiddenNote);
  }
  return parts.join(" · ");
}

/** Fill every card with a fresh title, definition, body and empty caption; keep and return the places by name. */
function layOutPlaces(figures) {
  const places = new Map();
  for (const { figure, card } of figures.cards) {
    const body = renderFigure(card, { ...figure, caption: "" });
    places.set(figure.name, { body, caption: card.querySelector(".figure-caption") });
  }
  figures.places = places;
  return places;
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
