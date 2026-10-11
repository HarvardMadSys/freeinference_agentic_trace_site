/**
 * The legend of a chart of more than one series, as one button per series: a click hides the series, or shows it
 * again, and the chart is drawn anew from the rows it already has, with no query. A hidden series' button is struck
 * through and not pressed.
 *
 * A legend is `{ series, colours }`: the series it lists, `[{ name, label }]`, `name` being the series' value in the
 * rows and `label` the text its button shows, and their colours, a Map from name to colour. The hidden series are a
 * Set of names; it lives as long as one drawing of the chart, so a new selection, which draws every chart afresh,
 * shows every series again, and it is never written to the URL.
 */

import { showNote } from "../shared/charts.js";

// The note in place of a chart whose every series is hidden.
const EVERY_SERIES_HIDDEN_NOTE = "Every series is hidden: click one in the legend to show it.";

/**
 * Fill `container` with one button per series of `series` (`[{ name, label }]`), each with its colour from `colours`
 * (a Map from name to colour), pressed unless its name is in `hidden`. A click flips the button between pressed and
 * struck through and calls `onToggle(name)`.
 */
export function mountLegend(container, series, colours, hidden, onToggle) {
  const buttons = [];
  for (const { name, label } of series) {
    buttons.push(legendButton(label, colours.get(name), hidden.has(name), () => onToggle(name)));
  }
  container.replaceChildren(...buttons);
}

/** A copy of `hidden` with `name` hidden when it was shown, and shown when it was hidden. */
export function toggledSeries(hidden, name) {
  const toggled = new Set(hidden);
  if (toggled.has(name)) {
    toggled.delete(name);
  } else {
    toggled.add(name);
  }
  return toggled;
}

/** The rows whose series, `row[seriesColumn]`, is not in `hidden`, in their order. */
export function shownRows(rows, seriesColumn, hidden) {
  return rows.filter((row) => !hidden.has(row[seriesColumn]));
}

/**
 * Place `legend`'s buttons just above `body` and draw the chart into `body` with `drawChart(hidden)`, nothing hidden
 * at first. Each click on a button hides or shows its series and calls `drawChart` again with the new hidden set; a
 * chart whose every series is hidden shows a note instead. Settles when the first drawing has.
 */
export async function drawWithLegend(body, legend, drawChart) {
  const place = document.createElement("div");
  place.className = "legend";
  body.before(place);
  let hidden = new Set();
  async function onToggle(name) {
    hidden = toggledSeries(hidden, name);
    await drawShownSeries(body, legend, hidden, drawChart);
  }
  mountLegend(place, legend.series, legend.colours, hidden, onToggle);
  await drawShownSeries(body, legend, hidden, drawChart);
}

/** True when every series of `series` (`[{ name }]`) is in `hidden`, so nothing is left to draw. */
export function isEverySeriesHidden(series, hidden) {
  return series.every((one) => hidden.has(one.name));
}

async function drawShownSeries(body, legend, hidden, drawChart) {
  if (isEverySeriesHidden(legend.series, hidden)) {
    showNote(body, EVERY_SERIES_HIDDEN_NOTE);
    return;
  }
  await drawChart(hidden);
}

function legendButton(label, colour, isHidden, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "legend-button";
  // Pressed means shown: the button's state follows each click, as the hidden set does.
  button.setAttribute("aria-pressed", String(!isHidden));
  const swatch = document.createElement("span");
  swatch.className = "legend-swatch";
  swatch.style.background = colour;
  button.append(swatch, label);
  button.addEventListener("click", () => flipAndCall(button, onClick));
  return button;
}

function flipAndCall(button, onClick) {
  const isPressed = button.getAttribute("aria-pressed") === "true";
  button.setAttribute("aria-pressed", String(!isPressed));
  onClick();
}
