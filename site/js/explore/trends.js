/**
 * The weekly trends: top-level sessions per week stacked by harness, their requests per week stacked by model, and
 * their input tokens per week split by whether the provider reports cache reads, over every week whatever the
 * selection. The selected weeks' bars are drawn solid, the others faint, and a click on a bar selects its week alone;
 * where the page gives no `context.onWeekClick` (null), a bar takes no click. Each chart's legend is a row of buttons
 * that hide and show its series (`explore/legend.js`). Each chart is a card of its own, laid out as the figure cards.
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`.
 */

import {
  columnTotal, drawBars, foldToOther, nameChart, renderFigure, showError, showLoading, sumFolded,
} from "../shared/charts.js";
import { weekTickFormat } from "../axes/ticks.js";
import { barColours, HARNESS_FIRST_SLOT, OTHER_SERIES, SERIES_SLOTS, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { seriesLegend } from "../figures/figure_rows.js";
import { formatCountTick, formatQuantity, formatTokens } from "../shared/format.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";
import { drawWithLegend, shownRows } from "./legend.js";

// A trend names as many series as the donut above it, the harnesses or models that hold the eight series colours, and
// folds the rest into "Other", so the donut's legend is also the trend's.
const NAMED_SERIES = SERIES_SLOTS.length;

// A bar of a week outside the selection is drawn at this opacity, so the selected weeks stand out.
const UNSELECTED_BAR_OPACITY = 0.3;

// The parts of a week's input tokens, bottom up: the query column each is read from and its colour.
// Unreported input has no cache split, so it takes the colour of no series.
const TOKEN_PARTS = Object.freeze([
  Object.freeze({ part: "cached", column: "cached_tokens", colour: TOKEN_PART_COLOURS.cached }),
  Object.freeze({ part: "uncached", column: "uncached_tokens", colour: TOKEN_PART_COLOURS.uncached }),
  Object.freeze({ part: "unreported", column: "unreported_tokens", colour: OTHER_SERIES }),
]);

// The label each part of a week's input tokens has in the legend.
const TOKEN_PART_LABELS = Object.freeze({
  cached: TOKEN_PART_NAMES.cached, uncached: TOKEN_PART_NAMES.uncached, unreported: "Not reported",
});

// The sentence every trend's definition ends with while a bar click selects a week: how the selection shows and how to
// change it.
const CLICK_HINT = "Faint bars are weeks outside the selection; click a bar to select its week alone.";

/** Fill `container` with the cards of the three trend charts, each loading: `{ sessions, requests, tokens }`. */
export function layoutTrends(container) {
  const sessions = document.createElement("article");
  const requests = document.createElement("article");
  const tokens = document.createElement("article");
  for (const place of [sessions, requests, tokens]) {
    place.className = "card";
    showLoading(place);
  }
  container.replaceChildren(sessions, requests, tokens);
  return { sessions, requests, tokens };
}

/** Lay out the trends in `container` and draw the three charts; a chart whose query fails shows its error there. */
export async function runTrends(container, context) {
  const places = layoutTrends(container);
  await Promise.all([
    drawSessionsPerWeek(places.sessions, context).catch((error) => showError(places.sessions, error)),
    drawRequestsPerWeek(places.requests, context).catch((error) => showError(places.requests, error)),
    drawInputTokensPerWeek(places.tokens, context).catch((error) => showError(places.tokens, error)),
  ]);
}

/** One row `{ week, part, tokens }` per week and part of its input tokens, in the weeks' order and cached first. */
export function tokenPartRows(weekRows) {
  const rows = [];
  for (const weekRow of weekRows) {
    for (const { part, column } of TOKEN_PARTS) {
      rows.push({ week: weekRow.week, part, tokens: weekRow[column] });
    }
  }
  return rows;
}

/** The opacity of a bar, by its row's week: solid when the week is among `selectedWeeks`, faint otherwise. */
export function barOpacity(row, selectedWeeks) {
  return selectedWeeks.includes(row.week) ? 1 : UNSELECTED_BAR_OPACITY;
}

/** The end of every trend's definition: " " and the click hint when a bar click selects a week, else nothing. */
export function clickHint(onWeekClick) {
  return onWeekClick === null ? "" : ` ${CLICK_HINT}`;
}

async function drawSessionsPerWeek(place, context) {
  const harnessRows = await context.orders.harnesses;
  const rows = await context.sessionsPerWeekByHarness; // the page asks for them once, for this and the harness mix
  const body = renderFigure(place, {
    title: "Sessions per week",
    caption: "Top-level sessions each week, by harness.",
    definition: `Top-level sessions per week, stacked by harness.${clickHint(context.onWeekClick)}`,
    rows: formatQuantity(columnTotal(rows, "sessions"), "session", "sessions"),
  });
  const order = harnessRows.map((row) => row.harness);
  const colours = barColours(order, HARNESS_FIRST_SLOT);
  await drawTrend(body, rows, context, { y: "sessions", fill: "harness", order, colours, yLabel: "Sessions" });
}

async function drawRequestsPerWeek(place, context) {
  const modelRows = await context.orders.models;
  const rows = await context.database.runQuery("explore/requests_per_week_by_model");
  const body = renderFigure(place, {
    title: "Requests per week",
    caption: "Requests each week, by model.",
    definition: `Requests of the top-level sessions per week, stacked by model.${clickHint(context.onWeekClick)}`,
    rows: formatQuantity(columnTotal(rows, "requests"), "request", "requests"),
  });
  // The models' order, which every figure colours them by: the eight with most requests take the series colours.
  const order = modelRows.map((row) => row.model);
  const colours = barColours(order);
  await drawTrend(body, rows, context, { y: "requests", fill: "model", order, colours, yLabel: "Requests" });
}

async function drawInputTokensPerWeek(place, context) {
  const rows = await context.database.runQuery("explore/input_tokens_per_week");
  const body = renderFigure(place, {
    title: "Input tokens per week",
    caption: "Input tokens each week, by cache status.",
    definition: "Input tokens of the top-level requests per week: cached and uncached where the provider reports cache "
      + `reads, not reported where it does not.${clickHint(context.onWeekClick)}`,
    rows: formatQuantity(columnTotal(rows, "requests"), "request", "requests"),
  });
  await drawTrend(body, tokenPartRows(rows), context, {
    y: "tokens",
    fill: "part",
    order: TOKEN_PARTS.map((part) => part.part),
    colours: new Map(TOKEN_PARTS.map((part) => [part.part, part.colour])),
    labels: TOKEN_PART_LABELS,
    yLabel: "Input tokens",
    format: formatTokens,
    legendTopDown: true,
  });
}

/**
 * Draw into `body` a trend's bars of `rows`, one stack per week, `options` saying which column is the height (`y`),
 * which the series (`fill`), the series' `order`, `colours` and, where a series' name is not its label, `labels`, and
 * how the y axis reads. Above them goes the legend that hides and shows a series, in the order of `colours`, or, with
 * `legendTopDown`, in the order the stack draws them from the top down; a series past the eighth of the order is first
 * folded into "Other", so the legend hides "Other" as one. A click on a bar selects its week, if any function takes it.
 */
async function drawTrend(body, rows, context, options) {
  const { y, fill, order, colours, labels = {}, legendTopDown = false } = options;
  const folded = sumFolded(foldToOther(rows, fill, order.slice(0, NAMED_SERIES)), { x: "week", y, fill });
  if (context.onWeekClick !== null) {
    body.classList.add("is-clickable");
  }
  const legend = seriesLegend(folded, fill, colours, labels);
  if (legendTopDown) {
    legend.series.reverse();
  }
  const drawShown = (hidden) => drawTrendBars(body, shownRows(folded, fill, hidden), context, options);
  await drawWithLegend(body, legend, drawShown);
}

async function drawTrendBars(body, rows, context, options) {
  const chart = await drawBars(body, rows, { ...weekBarOptions(context), ...options });
  nameChart(body);
  if (context.onWeekClick !== null) {
    chart.addEventListener("click", () => selectPointedWeek(chart, context.onWeekClick));
  }
}

// What every trend chart shares: one stacked bar per week of every week, the selected weeks solid.
function weekBarOptions(context) {
  return {
    x: "week",
    stacked: true,
    xLabel: null,
    yAxisLabel: null, // the card's title names what the bars count
    xTickFormat: weekTickFormat(context.weeks.map((entry) => entry.week)),
    xDomain: context.weeks.map((entry) => entry.week),
    yTickFormat: formatCountTick,
    fillOpacity: (row) => barOpacity(row, context.selection.weeks),
  };
}

function selectPointedWeek(chart, onWeekClick) {
  // Plot keeps the row under the pointer, the one its tooltip shows, as the chart's `value`; null when there is none.
  if (chart.value) {
    onWeekClick(chart.value.week);
  }
}
