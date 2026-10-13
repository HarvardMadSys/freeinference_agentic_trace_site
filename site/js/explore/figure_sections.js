/**
 * The figure sections of the Explore page's Insights: the Session-structure, Tokens-and-cost, Latency, Tools,
 * Prefix-caching and Human-driven-against-benchmark figures, each a card in its section's grid, drawn from its query's
 * answer over every week and the paper's harnesses, its thin bins hidden and its line of rows written behind its
 * Definition control. A histogram figure, one with a `statsQuery`, is drawn by `shared/histogram.js` from its two
 * queries' answers, every bin shown.
 *
 * Only the figures of a shown topic are drawn: a hidden topic's cards have no width to draw a chart at, so its figures
 * start when the topic is shown (`startFigures`). A figure started is not started again, unless its topic was hidden
 * before it was drawn.
 *
 * `figures` is what the page keeps of them: `{ cards, places, run }`, every figure with its card and its topic's
 * section (`[{ figure, card, topic }]`), the places of the layout by figure name (`{ body, rows, topic }`, `rows` the
 * line of rows), and the run (`newFigureRun`; null until the page runs the figures). A run's `context` is what the page
 * gives every section; see `explore/start.js`. Each figure shows its own loading state, error or note.
 *
 * A figure with a `legend` draws it as buttons above its chart (`explore/legend.js`); a click hides or shows a series
 * and draws the chart again from the rows already fetched.
 */

import { MIN_ROWS_PER_BIN, nameChart, renderFigure, showError, showLoading, showNote } from "../shared/charts.js";
import { runQuery } from "../shared/database.js";
import { figureColours } from "../theme/colours.js";
import { drawHistogram, histogramCard, rowsText } from "../shared/histogram.js";
import { dropThinGroups, figureRowsText, unsimulatedWeeks } from "../figures/figure_rows.js";
import { drawWithLegend, shownRows } from "./legend.js";

/**
 * Each figure section of the Insights, in the page's order: the element its figures go in, and the module listing
 * them. Every section module exports its figures as `FIGURES` and its topic's takeaway as `TAKEAWAY`, so each is
 * imported by its path rather than under a second name.
 */
export const FIGURE_SECTIONS = Object.freeze([
  Object.freeze({ selector: "#insights-sessions", module: "../figures/sessions.js" }),
  Object.freeze({ selector: "#insights-tokens", module: "../figures/tokens.js" }),
  Object.freeze({ selector: "#insights-latency", module: "../figures/latency.js" }),
  Object.freeze({ selector: "#insights-tools", module: "../figures/tools.js" }),
  Object.freeze({ selector: "#insights-caching", module: "../figures/caching.js" }),
  Object.freeze({ selector: "#insights-comparison", module: "../comparison/comparison.js" }),
]);

const NO_ROWS_NOTE = "No rows over every week and the paper's harnesses.";
const ALL_THIN_NOTE = `Too few rows: every bin has fewer than ${MIN_ROWS_PER_BIN} rows.`;

/**
 * Place a card for every figure of every section of `FIGURE_SECTIONS`; return what the page keeps of the figures,
 * nothing laid out yet.
 */
export async function mountFigureSections() {
  return { cards: await placeCards(), places: new Map(), run: null };
}

/** Lay out every figure, each loading. */
export function layoutFigures(figures) {
  for (const { body } of layOutPlaces(figures).values()) {
    showLoading(body);
  }
}

/** Lay out every figure, each showing `error`. */
export function showErrorInFigures(figures, error) {
  for (const { body } of layOutPlaces(figures).values()) {
    showError(body, error);
  }
}

/**
 * Run the figures for `context`, in the places of the layout: every figure of the shown topic now, and a hidden topic's
 * when it is shown. Settles when the figures started now are drawn.
 */
export async function runFigures(figures, context) {
  figures.run = newFigureRun(context);
  await Promise.all(startFigures(figures));
}

/** A run of the figures for `context`, none of them started yet. */
export function newFigureRun(context) {
  return { context, startedNames: new Set() };
}

/**
 * Start drawing the figures of the shown topics that the run has not started, marking each started, as the run or a
 * topic shown asks; return their drawings. Before the run there is nothing to start.
 */
export function startFigures(figures) {
  const run = figures.run;
  if (run === null) {
    return [];
  }
  const drawings = [];
  for (const figure of shownFigures(figures.cards)) {
    if (!run.startedNames.has(figure.name)) {
      run.startedNames.add(figure.name);
      drawings.push(drawFigureInRun(figure, figures.places.get(figure.name), run));
    }
  }
  return drawings;
}

/** The figures of `cards` (`[{ figure, topic }]`) whose topic's section is shown. */
function shownFigures(cards) {
  return cards.filter((entry) => !entry.topic.hidden).map((entry) => entry.figure);
}

/**
 * Draw `figure` into `place` for `run`. A topic hidden before the drawing settled may have hidden the chart as it read
 * its width, so the figure is marked unstarted again and drawn anew when its topic is next shown.
 */
async function drawFigureInRun(figure, place, run) {
  await drawFigure(figure, place, run.context);
  if (place.topic.hidden) {
    run.startedNames.delete(figure.name);
  }
}

/** Draw one figure into `place`, a histogram or a chart of one query's rows; its error stays in its own card. */
async function drawFigure(figure, place, context) {
  try {
    if (figure.statsQuery === undefined) {
      await drawQueryFigure(figure, place, context);
    } else {
      await drawHistogramFigure(figure, place);
    }
  } catch (error) {
    showError(place.body, error);
  }
}

/** Run a histogram figure's bins and stats queries and draw its histogram into `place`, its count as its line of rows. */
async function drawHistogramFigure(figure, place) {
  const binRows = await runQuery(figure.query);
  const statsRows = await runQuery(figure.statsQuery);
  const card = histogramCard(figure, binRows, statsRows[0]);
  place.rows.textContent = rowsText(card);
  await drawHistogram(place.body, card);
  nameChart(place.body);
}

/** Run one figure's query and draw its rows into `place`, its thin bins hidden, with its line of rows. */
async function drawQueryFigure(figure, place, context) {
  const colours = await figureColours(context.orders);
  let rows = await runQuery(figure.query);
  if (figure.drawnRows !== undefined) {
    rows = figure.drawnRows(rows, colours);
  }
  const { rows: shown, hidden } = dropThinGroups(rows, figure.binColumn);
  const notSimulated = unsimulatedWeeks(figure, context.weeks);
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
 * Draw `figure`'s rows with the series named in `hidden` left out, and name its chart: a figure whose rows each name
 * their series in `seriesColumn` is drawn from the rows of the other series. Every figure is given `hidden`; one that
 * holds its series in columns leaves those out of its marks.
 */
export async function drawFigureSeries(figure, rows, body, colours, hidden) {
  const shown = figure.seriesColumn === undefined ? rows : shownRows(rows, figure.seriesColumn, hidden);
  await figure.draw(shown, body, colours, hidden);
  nameChart(body);
}

/**
 * Draw a figure's rows into `body`; a figure without a legend hides no series. A figure of more than one series (one
 * with a `legend`) gets its legend of buttons above the chart, a short line per series for a figure that `drawsLines`,
 * else a square, and its draw function its legend's colours as `colours.series`. The legend function is given the
 * figure's `seriesColumn`, undefined for a figure that holds its series in columns.
 */
async function drawFigureRows(figure, rows, body, colours) {
  if (figure.legend === undefined) {
    await drawFigureSeries(figure, rows, body, colours, new Set());
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
  for (const { figure, card, topic } of figures.cards) {
    const body = renderFigure(card, figure);
    places.set(figure.name, { body, rows: card.querySelector(".figure-rows"), topic });
  }
  figures.places = places;
  return places;
}

/**
 * Every figure of every section of `FIGURE_SECTIONS`, each with a new card in its section's grid and that section,
 * `[{ figure, card, topic }]`; each section's takeaway is written under its heading. A section whose module fails to
 * load shows the error in its grid and has no cards; the others are placed.
 */
async function placeCards() {
  const cards = [];
  for (const section of FIGURE_SECTIONS) {
    const topic = document.querySelector(section.selector);
    const grid = topic.querySelector(".card-grid");
    try {
      const { FIGURES, TAKEAWAY } = await import(section.module);
      placeTakeaway(topic, TAKEAWAY);
      for (const figure of FIGURES) {
        const card = document.createElement("article");
        card.className = figure.isWide === true ? "card is-wide" : "card";
        card.id = figure.name;
        grid.append(card);
        cards.push({ figure, card, topic });
      }
    } catch (error) {
      showError(grid, error);
    }
  }
  return cards;
}

/** Write `takeaway`, the topic's one sentence, under the heading of `section`. */
function placeTakeaway(section, takeaway) {
  const line = document.createElement("p");
  line.className = "topic-takeaway";
  line.textContent = takeaway;
  section.querySelector("h2").after(line);
}
