/**
 * The weekly trends: top-level sessions per week stacked by harness, their requests per week stacked by model, and
 * their input tokens per week split by whether the provider reports cache reads, over every week whatever the selection. The selected weeks'
 * bars are drawn solid, the others faint, and a click on a bar selects its week alone.
 *
 * A section's `context` is what the page gives every section; see `pages/explore.js`.
 */

import { OTHER_SERIES, TOKEN_PART_COLOURS, captionText, drawBars, renderFigure, showError, showLoading } from "../shared/charts.js";
import { formatTokens, monthAndDay } from "../shared/format.js";
import { harnessesText, weeksByMonth } from "../shared/selection.js";

// A bar of a week outside the selection is drawn at this opacity, so the selected weeks stand out.
const UNSELECTED_BAR_OPACITY = 0.3;

// The parts of a week's input tokens, bottom up: the query column each is read from and its colour.
// Unreported input has no cache split, so it takes the colour of no series.
const TOKEN_PARTS = Object.freeze([
  Object.freeze({ part: "cached", column: "cached_tokens", colour: TOKEN_PART_COLOURS.cached }),
  Object.freeze({ part: "uncached", column: "uncached_tokens", colour: TOKEN_PART_COLOURS.uncached }),
  Object.freeze({ part: "unreported", column: "unreported_tokens", colour: OTHER_SERIES }),
]);

// The sentence every trend's definition ends with: how the selection shows and how to change it.
const CLICK_HINT = "Faint bars are weeks outside the selection; click a bar to select its week alone.";

/** Fill `container` with the places of the three trend charts, each loading; return them as `{ sessions, requests, tokens }`. */
export function layoutTrends(container) {
  const grid = document.createElement("div");
  grid.className = "card-grid";
  const sessions = document.createElement("div");
  const requests = document.createElement("div");
  const tokens = document.createElement("div");
  for (const place of [sessions, requests, tokens]) {
    showLoading(place);
  }
  grid.append(sessions, requests, tokens);
  container.replaceChildren(grid);
  return { sessions, requests, tokens };
}

/** Lay out the trends in `container` and draw the three charts; a chart whose query fails shows its error in its place. */
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

/** The weeks whose tick is labelled: the first week of each month, so sixteen ticks never crowd a narrow chart. */
export function labelledWeeks(weeks) {
  return weeksByMonth(weeks).map((group) => group.weeks[0].week);
}

/** The text of a week's tick: its Sunday as "MM-DD" when it is among `labelled`, otherwise none. */
export function weekTick(week, labelled) {
  return labelled.includes(week) ? monthAndDay(week) : "";
}

/** The opacity of a bar, by its row's week: solid when the week is among `selectedWeeks`, faint otherwise. */
export function barOpacity(row, selectedWeeks) {
  return selectedWeeks.includes(row.week) ? 1 : UNSELECTED_BAR_OPACITY;
}

/** The sum of `row[column]` over `rows`. */
export function columnTotal(rows, column) {
  let total = 0;
  for (const row of rows) {
    total += row[column];
  }
  return total;
}

async function drawSessionsPerWeek(place, context) {
  const harnessRows = await context.orders.harnesses;
  const rows = await context.database.runQuery("explore/sessions_per_week_by_harness");
  const body = renderFigure(place, {
    title: "Sessions per week",
    definition: `Top-level sessions per week, stacked by harness, of the selected harnesses. ${CLICK_HINT}`,
    caption: everyWeekCaption(columnTotal(rows, "sessions"), context),
  });
  const chart = await drawBars(body, rows, {
    ...weekBarOptions(context),
    y: "sessions",
    fill: "harness",
    order: harnessRows.map((row) => row.harness),
    yLabel: "Sessions",
  });
  listenForWeekClick(body, chart, context.onWeekClick);
}

async function drawRequestsPerWeek(place, context) {
  const modelRows = await context.orders.models;
  const rows = await context.database.runQuery("explore/requests_per_week_by_model");
  const body = renderFigure(place, {
    title: "Requests per week",
    definition: `Requests of the top-level sessions per week, stacked by model, of the selected harnesses. ${CLICK_HINT}`,
    caption: everyWeekCaption(columnTotal(rows, "requests"), context),
  });
  // The models' order, which every figure colours them by: the eight with most requests take the series colours.
  const chart = await drawBars(body, rows, {
    ...weekBarOptions(context),
    y: "requests",
    fill: "model",
    order: modelRows.map((row) => row.model),
    yLabel: "Requests",
  });
  listenForWeekClick(body, chart, context.onWeekClick);
}

async function drawInputTokensPerWeek(place, context) {
  const rows = await context.database.runQuery("explore/input_tokens_per_week");
  const body = renderFigure(place, {
    title: "Input tokens per week",
    definition: "Input tokens of the top-level requests per week, of the selected harnesses: cached and uncached where "
      + `the provider reports cache reads, unreported where it does not. ${CLICK_HINT}`,
    caption: everyWeekCaption(columnTotal(rows, "requests"), context),
  });
  const chart = await drawBars(body, tokenPartRows(rows), {
    ...weekBarOptions(context),
    y: "tokens",
    fill: "part",
    order: TOKEN_PARTS.map((part) => part.part),
    colours: new Map(TOKEN_PARTS.map((part) => [part.part, part.colour])),
    yLabel: "Input tokens",
    format: formatTokens,
  });
  listenForWeekClick(body, chart, context.onWeekClick);
}

// What every trend chart shares: one stacked bar per week of every week, the selected weeks solid.
function weekBarOptions(context) {
  return {
    x: "week",
    stacked: true,
    xLabel: "Week",
    xTickFormat: (week) => weekTick(week, labelledWeeks(context.weeks)),
    xDomain: context.weeks.map((entry) => entry.week),
    fillOpacity: (row) => barOpacity(row, context.selection.weeks),
  };
}

function everyWeekCaption(rowCount, context) {
  const harnesses = harnessesText(context.selection.harnesses, context.harnesses);
  return captionText({ rows: rowCount, harnesses, weeks: context.weeks.map((entry) => entry.week) });
}

function listenForWeekClick(body, chart, onWeekClick) {
  body.classList.add("is-clickable");
  chart.addEventListener("click", () => selectPointedWeek(chart, onWeekClick));
}

function selectPointedWeek(chart, onWeekClick) {
  // Plot keeps the row under the pointer, the one its tooltip shows, as the chart's `value`; null when there is none.
  if (chart.value) {
    onWeekClick(chart.value.week);
  }
}
