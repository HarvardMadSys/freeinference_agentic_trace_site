/**
 * The figure sections of the Explore page: the Sessions, Tools and Prefix-caching figures, each a card in its
 * section's grid, drawn for the selected weeks and harnesses, its thin bins hidden and its caption written.
 *
 * With the default selection every figure is drawn at once, from its precomputed answer. With any other, a figure's
 * query starts when its card comes into view, and a figure started for the current run is not started again.
 *
 * `figures` is what the page keeps of them: `{ cards, places, run, visibleNames }`, every figure with its card
 * (`[{ figure, card }]`), the places of the latest layout by figure name (`{ body, caption }`), the current run
 * (`newFigureRun`; null from a layout until its run starts), and the names of the figures whose cards are in view.
 * Each layout makes fresh places, so a run that a newer one replaced draws into places no longer on the page. A run's
 * `context` is what the page gives every section; see `pages/explore.js`. Each figure shows its own loading state,
 * error or note.
 */

import { assignColours, MIN_ROWS_PER_BIN, renderFigure, showError, showLoading, showNote, weeksText } from "../shared/charts.js";
import { isDefaultSelection } from "../shared/selection.js";
import { drawnHarnessesAndWeeks, dropThinGroups, hiddenText, restingCountText } from "../figures/figure_rows.js";

// Each figure section of the page: the element its figures go in, and the module listing them. Every section module
// exports its figures as `FIGURES`, so each is imported by its path rather than under a second name.
const SECTIONS = Object.freeze([
  Object.freeze({ selector: "#figures-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#figures-tools", module: "../figures/tools.js" }),
  Object.freeze({ selector: "#figures-caching", module: "../figures/caching.js" }),
]);

// A card counts as in view from one viewport height above the viewport to one below it, so the row of figures after
// the visible one is drawn before it is scrolled to.
const IN_VIEW_MARGIN = "100% 0px";

const NO_ROWS_NOTE = "No rows for this selection.";
const ALL_THIN_NOTE = `Too few rows: every bin of this selection has fewer than ${MIN_ROWS_PER_BIN} rows.`;

/**
 * Place a card for every figure of every section and watch which cards are in view; return what the page keeps of the
 * figures, nothing laid out yet.
 */
export async function mountFigureSections() {
  const figures = { cards: await placeCards(), places: new Map(), run: null, visibleNames: new Set() };
  const onReport = (entries) => noteCardsInView(figures, entries);
  const observer = new IntersectionObserver(onReport, { rootMargin: IN_VIEW_MARGIN });
  for (const { card } of figures.cards) {
    observer.observe(card);
  }
  return figures;
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

/**
 * Start a run of the figures for `context`'s selection, in the places of the latest layout: every figure at once for
 * the default selection, else those in view now and the others as they come into view. Settles when the figures
 * started now are drawn.
 */
export async function runFigures(figures, context) {
  const drawsAtOnce = isDefaultSelection(context.selection, context.weeks, context.harnesses);
  figures.run = newFigureRun(context, drawsAtOnce);
  await Promise.all(startFigures(figures));
}

/** A run of the figures for `context`: drawn all at once when `drawsAtOnce`, else as they come into view; none started. */
export function newFigureRun(context, drawsAtOnce) {
  return { context, drawsAtOnce, startedNames: new Set() };
}

/**
 * The entries of `figureList` (each with a `name`) that `run` starts now: those it has not started, and, unless it
 * draws every figure at once, whose names are in `visibleNames`.
 */
export function figuresToStart(run, figureList, visibleNames) {
  const toStart = [];
  for (const figure of figureList) {
    const isWanted = run.drawsAtOnce || visibleNames.has(figure.name);
    if (isWanted && !run.startedNames.has(figure.name)) {
      toStart.push(figure);
    }
  }
  return toStart;
}

/** Keep `visibleNames` current with intersection entries: a card's id is added while it is in view, removed when not. */
export function noteVisibility(visibleNames, entries) {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      visibleNames.add(entry.target.id);
    } else {
      visibleNames.delete(entry.target.id);
    }
  }
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

/** Note which cards are in view, then start the current run's figures that came into view. */
function noteCardsInView(figures, entries) {
  noteVisibility(figures.visibleNames, entries);
  startFigures(figures);
}

/** Start drawing the figures the current run draws now, marking each started; return their drawings. */
function startFigures(figures) {
  const run = figures.run;
  if (run === null) {
    return [];
  }
  const figureList = figures.cards.map(({ figure }) => figure);
  const drawings = [];
  for (const figure of figuresToStart(run, figureList, figures.visibleNames)) {
    run.startedNames.add(figure.name);
    drawings.push(drawFigure(figure, figures.places.get(figure.name), run.context));
  }
  return drawings;
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
  figures.run = null; // the run of this layout starts once the database holds its selection
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
