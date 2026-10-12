/**
 * The figure sections of the Explore page: the Sessions, Tokens-and-cost, Latency, Tools, Prefix-caching and
 * Human-driven-against-benchmark figures, each a card in its section's grid, drawn for the selected weeks and harnesses,
 * its thin bins hidden and its line of rows written behind its Definition control. A histogram figure, one with a
 * `statsQuery`, is drawn by `shared/histogram.js` from its two queries' answers, every bin shown.
 *
 * With the default selection every figure is drawn at once, from its precomputed answer. With any other, a figure's
 * query starts when its card comes into view, and a figure started for the current run is not started again. A page
 * that draws every run at once, whatever the selection, watches no card.
 *
 * `figures` is what the page keeps of them: `{ cards, places, run, visibleNames, drawsEveryRunAtOnce }`, every figure
 * with its card (`[{ figure, card }]`), the places of the latest layout by figure name (`{ body, rows }`, `rows` the line of rows), the
 * current run (`newFigureRun`; null from a layout until its run starts), the names of the figures whose cards are in
 * view, and whether every run draws all its figures at once.
 * Each layout makes fresh places, so a run that a newer one replaced draws into places no longer on the page. A run's
 * `context` is what the page gives every section; see `pages/explore.js`. Each figure shows its own loading state,
 * error or note.
 *
 * A figure with a `legend` draws it as buttons above its chart (`explore/legend.js`); a click hides or shows a series
 * and draws the chart again from the rows already fetched. The hidden series belong to the card's drawing in the
 * current run, so a new selection, which starts a new run, shows every series again.
 */

import { MIN_ROWS_PER_BIN, renderFigure, showError, showLoading, showNote } from "../shared/charts.js";
import { assignColours } from "../theme/colours.js";
import { isDefaultSelection } from "../shared/selection.js";
import { drawHistogram, histogramCard, rowsText } from "../shared/histogram.js";
import { dropThinGroups, figureDrawnRows, figureRowsText, unsimulatedWeeks } from "../figures/figure_rows.js";
import { drawWithLegend, shownRows } from "./legend.js";

/**
 * Each figure section of the page, in the page's order: the element its figures go in, and the module listing them.
 * Every section module exports its figures as `FIGURES`, so each is imported by its path rather than under a second name.
 */
export const FIGURE_SECTIONS = Object.freeze([
  Object.freeze({ selector: "#figures-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#figures-tokens", module: "../figures/tokens.js" }),
  Object.freeze({ selector: "#figures-latency", module: "../figures/latency.js" }),
  Object.freeze({ selector: "#figures-tools", module: "../figures/tools.js" }),
  Object.freeze({ selector: "#figures-caching", module: "../figures/caching.js" }),
  Object.freeze({ selector: "#figures-comparison", module: "../comparison/comparison.js" }),
]);

// A card counts as in view from one viewport height above the viewport to one below it, so the row of figures after
// the visible one is drawn before it is scrolled to.
const IN_VIEW_MARGIN = "100% 0px";

const NO_ROWS_NOTE = "No rows over every week and the paper's harnesses.";
const ALL_THIN_NOTE = `Too few rows: every bin has fewer than ${MIN_ROWS_PER_BIN} rows.`;

/**
 * Place a card for every figure of every section and, unless `drawsEveryRunAtOnce`, watch which cards are in view;
 * return what the page keeps of the figures, nothing laid out yet.
 */
export async function mountFigureSections(drawsEveryRunAtOnce = false) {
  const cards = await placeCards();
  const figures = { cards, places: new Map(), run: null, visibleNames: new Set(), drawsEveryRunAtOnce };
  if (drawsEveryRunAtOnce) {
    return figures;
  }
  const onReport = (entries) => noteCardsInView(figures, entries);
  const observer = new IntersectionObserver(onReport, { rootMargin: IN_VIEW_MARGIN });
  for (const { card } of figures.cards) {
    observer.observe(card);
  }
  return figures;
}

/** Show `error` in place of each figure section's cards, when the page cannot load the indexes to place them. */
export function showErrorInFigureSections(error) {
  for (const section of FIGURE_SECTIONS) {
    showError(document.querySelector(`${section.selector} .card-grid`), error);
  }
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
 * the default selection or a page that draws every run at once, else those in view now and the others as they come
 * into view. Settles when the figures started now are drawn.
 */
export async function runFigures(figures, context) {
  figures.run = newFigureRun(context, runDrawsAtOnce(figures.drawsEveryRunAtOnce, context));
  await Promise.all(startFigures(figures));
}

/**
 * Whether a run for `context` draws every figure at once: always when the page draws every run at once
 * (`drawsEveryRunAtOnce`), else only for the default selection.
 */
export function runDrawsAtOnce(drawsEveryRunAtOnce, context) {
  return drawsEveryRunAtOnce || isDefaultSelection(context.selection, context.weeks, context.harnesses);
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

/**
 * The colours every figure shares, `{ models, categories, providers }`, each a Map from name to colour, from the colour
 * orders, which do not depend on the selection.
 */
export async function figureColours(orders) {
  const models = await orders.models;
  const categories = await orders.categories;
  const providers = await orders.providers;
  return Object.freeze({
    models: assignColours(models.map((row) => row.model)),
    categories: assignColours(categories.map((row) => row.category)),
    providers: assignColours(providers.map((row) => row.provider)),
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

/** Draw one figure into `place`, a histogram or a chart of one query's rows; its error stays in its own card. */
async function drawFigure(figure, place, context) {
  try {
    if (figure.statsQuery === undefined) {
      await drawQueryFigure(figure, place, context);
    } else {
      await drawHistogramFigure(figure, place, context);
    }
  } catch (error) {
    showError(place.body, error);
  }
}

/** Run a histogram figure's bins and stats queries and draw its histogram into `place`, its count as its line of rows. */
async function drawHistogramFigure(figure, place, context) {
  const binRows = await context.database.runQuery(figure.query);
  const statsRows = await context.database.runQuery(figure.statsQuery);
  const card = histogramCard(figure, binRows, statsRows[0]);
  place.rows.textContent = rowsText(card);
  await drawHistogram(place.body, card);
}

/** Run one figure's query and draw its rows into `place`, its thin bins hidden, with its line of rows. */
async function drawQueryFigure(figure, place, context) {
  const colours = await figureColours(context.orders);
  const rows = figureDrawnRows(figure, await context.database.runQuery(figure.query), colours);
  const { rows: shown, hidden } = dropThinGroups(rows, figure.binColumn);
  const notSimulated = unsimulatedWeeks(figure, context.selection, context.weeks);
  place.rows.textContent = figureRowsText(figure, shown, hidden, notSimulated);
  if (rows.length === 0) {
    showNote(place.body, NO_ROWS_NOTE);
  } else if (shown.length === 0) {
    showNote(place.body, ALL_THIN_NOTE);
  } else {
    await drawFigureRows(figure, shown, place.body, colours);
  }
}

/**
 * Draw `figure`'s rows with the series named in `hidden` left out: a figure whose rows each name their series in
 * `seriesColumn` is drawn from the rows of the other series; any other is given `hidden` and leaves those series out
 * of its marks.
 */
export async function drawFigureSeries(figure, rows, body, colours, hidden) {
  if (figure.seriesColumn !== undefined) {
    await figure.draw(shownRows(rows, figure.seriesColumn, hidden), body, colours);
  } else {
    await figure.draw(rows, body, colours, hidden);
  }
}

/**
 * Draw a figure's rows into `body`. A figure of more than one series (one with a `legend`) gets its legend of buttons
 * above the chart, a short line per series for a figure that `drawsLines`, else a square, and its draw function its
 * legend's colours as `colours.series`. The legend function is given the
 * figure's `seriesColumn`, undefined for a figure that holds its series in columns.
 */
async function drawFigureRows(figure, rows, body, colours) {
  if (figure.legend === undefined) {
    await figure.draw(rows, body, colours);
    return;
  }
  const legend = figure.legend(rows, colours, figure.seriesColumn);
  const seriesColours = { ...colours, series: legend.colours };
  const swatch = figure.drawsLines === true ? "line" : "square";
  const drawShown = (hidden) => drawFigureSeries(figure, rows, body, seriesColours, hidden);
  await drawWithLegend(body, legend, drawShown, swatch);
}

/** Fill every card with a fresh title, caption, body and Definition control; keep and return the places by name. */
function layOutPlaces(figures) {
  const places = new Map();
  for (const { figure, card } of figures.cards) {
    const body = renderFigure(card, figure);
    places.set(figure.name, { body, rows: card.querySelector(".figure-rows") });
  }
  figures.places = places;
  figures.run = null; // the run of this layout starts once the database holds its selection
  return places;
}

/** Every figure of every section, each with a new card in its section's grid: `[{ figure, card }]`. */
async function placeCards() {
  const cards = [];
  for (const section of FIGURE_SECTIONS) {
    const { FIGURES } = await import(section.module);
    const grid = document.querySelector(`${section.selector} .card-grid`);
    for (const figure of FIGURES) {
      const card = document.createElement("article");
      card.className = figure.isWide === true ? "card is-wide" : "card";
      card.id = figure.name;
      grid.append(card);
      cards.push({ figure, card });
    }
  }
  return cards;
}
