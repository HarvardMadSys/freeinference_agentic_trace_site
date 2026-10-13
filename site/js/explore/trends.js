/**
 * The weekly trends: top-level sessions per week stacked by harness, their requests per week stacked by model, and
 * their input tokens per week split by whether the provider reports cache reads, over every week. Each chart's legend
 * is a row of buttons that hide and show its series (`explore/legend.js`). Each chart is a card of its own, laid out as
 * the figure cards, and drawn by the stacked-bars kind (`charts/stacked_bars.js`).
 *
 * A section's `context` is what the page gives every section; see `explore/start.js`.
 */

import { columnTotal, nameChart, renderFigure, showError, showLoading } from "../shared/charts.js";
import { readAnswer } from "../shared/answers.js";
import { barColours, HARNESS_FIRST_SLOT, OTHER_SERIES, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { formatCompactCount, formatCount, formatCountTick, formatQuantity } from "../shared/format.js";
import { TOKEN_PART_NAMES } from "../session/token_parts.js";
import { drawStackedBars, stackedBarsLegend } from "../charts/stacked_bars.js";
import { drawWithLegend } from "./legend.js";
import { harnessText } from "./sessions_table_state.js";

// A trend's margins, in pixels: room on the left for a count tick ("150k") and little on the right, so the bars take the
// card's width; the card's title names what the bars count, so the y axis has no title to keep room for.
const TREND_MARGINS = Object.freeze({ marginLeft: 44, marginRight: 8 });

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

/** Fill `container` with the cards of the three trend charts, each loading: `{ sessions, requests, tokens }`. */
function layoutTrends(container) {
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

async function drawSessionsPerWeek(place, context) {
  const harnessRows = await context.orders.harnesses;
  const rows = await context.sessionsPerWeekByHarness; // the page asks for them once, for this and the harness mix
  const body = renderFigure(place, {
    title: "Sessions per week",
    caption: "Top-level sessions each week, by harness.",
    definition: "Top-level sessions per week, stacked by harness.",
    rows: formatQuantity(columnTotal(rows, "sessions"), "session", "sessions"),
  });
  const order = harnessRows.map((row) => row.harness);
  const colours = barColours(order, HARNESS_FIRST_SLOT);
  // The benchmark replay's harness is named as the Session Explorer names it, "swe-bench".
  const labels = Object.fromEntries(order.map((harness) => [harness, harnessText(harness)]));
  await drawTrend(body, rows, context, {
    seriesColumn: "harness",
    valueColumn: "sessions",
    colours,
    labels,
    valueLabel: "Sessions",
    valueFormat: formatCount,
  });
}

async function drawRequestsPerWeek(place, context) {
  const modelRows = await context.orders.models;
  const rows = await readAnswer("explore/requests_per_week_by_model");
  const body = renderFigure(place, {
    title: "Requests per week",
    caption: "Requests each week, by model.",
    definition: "Requests of the top-level sessions per week, stacked by model.",
    rows: formatQuantity(columnTotal(rows, "requests"), "request", "requests"),
  });
  // The models' order, which every figure colours them by: the eight with most requests take the series colours.
  const colours = barColours(modelRows.map((row) => row.model));
  await drawTrend(body, rows, context, {
    seriesColumn: "model",
    valueColumn: "requests",
    colours,
    labels: {},
    valueLabel: "Requests",
    valueFormat: formatCount,
  });
}

async function drawInputTokensPerWeek(place, context) {
  const rows = await readAnswer("explore/input_tokens_per_week");
  const body = renderFigure(place, {
    title: "Input tokens per week",
    caption: "Input tokens each week, by cache status.",
    definition: "Input tokens of the top-level requests per week: cached and uncached where the provider reports cache "
      + "reads, not reported where it does not.",
    rows: formatQuantity(columnTotal(rows, "requests"), "request", "requests"),
  });
  await drawTrend(body, tokenPartRows(rows), context, {
    seriesColumn: "part",
    valueColumn: "tokens",
    colours: new Map(TOKEN_PARTS.map((part) => [part.part, part.colour])),
    labels: TOKEN_PART_LABELS,
    valueLabel: "Input tokens",
    valueFormat: formatCompactCount,
    legendTopDown: true,
  });
}

/**
 * Draw into `body` a trend's bars of `rows`, one stack per week of every week, `trend` saying which column names the
 * series (`seriesColumn`) and which holds the height (`valueColumn`), the series' `colours` (a Map from name to colour,
 * the eight series colours first) and, where a series' name is not its label, `labels`, and how a value reads
 * (`valueLabel`, `valueFormat`). Above them goes the legend that hides and shows a series, in the order of `colours`,
 * or, with `legendTopDown`, in the order the stack draws them from the top down.
 */
async function drawTrend(body, rows, context, trend) {
  const { seriesColumn, valueColumn, colours, labels, legendTopDown = false } = trend;
  const legend = stackedBarsLegend(rows, colours, { xColumn: "week", seriesColumn, valueColumn, labels });
  if (legendTopDown) {
    legend.series.reverse();
  }
  await drawWithLegend(body, legend, (hidden) => drawTrendBars(rows, body, context, trend, hidden));
}

// Draw a trend's bars of the series not in `hidden`, with no y-axis title, since the card's title names what the bars
// count, and name the chart.
async function drawTrendBars(rows, body, context, trend, hidden) {
  await drawStackedBars(rows, body, { series: trend.colours }, {
    xColumn: "week",
    seriesColumn: trend.seriesColumn,
    valueColumn: trend.valueColumn,
    valueLabel: trend.valueLabel,
    yLabel: null,
    valueFormat: trend.valueFormat,
    yTickFormat: formatCountTick,
    weeks: context.weeks,
    margins: TREND_MARGINS,
  }, hidden);
  nameChart(body);
}
