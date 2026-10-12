/**
 * The legend of a chart of more than one series, as one button per series: a click hides the series, or shows it
 * again, and the chart is drawn anew from the rows it already has, with no query. A hidden series' button is struck
 * through and not pressed. A chart of fewer than two series has no legend.
 *
 * A legend is `{ series, colours }`: the series it lists, `[{ name, label }]`, `name` being the series' value in the
 * rows and `label` the text its button shows, and their colours, a Map from name to colour. The hidden series are a
 * Set of names; it lives as long as one drawing of the chart, so a new selection, which draws every chart afresh,
 * shows every series again, and it is never written to the URL.
 */

import { legendPlace, showError, showNote } from "../shared/charts.js";

// The note in place of a chart whose every series is hidden.
const EVERY_SERIES_HIDDEN_NOTE = "Every series is hidden: click one in the legend to show it.";

// A legend lists at least this many series: with one there is nothing to choose between, and the chart stays as it is.
const MIN_SERIES_IN_LEGEND = 2;

/**
 * Fill `container` with one button per series of `series` (`[{ name, label }]`), each with its colour from `colours`
 * (a Map from name to colour) in a swatch shaped as the chart draws it, `swatch` ("square" or "line"), pressed unless
 * its name is in `hidden`. A click flips the button between pressed and struck through and calls `onToggle(name)`.
 * Fewer than two series leave `container` empty.
 */
export function mountLegend(container, series, colours, hidden, onToggle, swatch = "square") {
  if (!hasLegend(series)) {
    container.replaceChildren();
    return;
  }
  const buttons = [];
  for (const { name, label } of series) {
    buttons.push(legendButton({ label, colour: colours.get(name), swatch }, hidden.has(name), () => onToggle(name)));
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

/** True when `series` (`[{ name }]`) is long enough to be given a legend: two series or more. */
export function hasLegend(series) {
  return series.length >= MIN_SERIES_IN_LEGEND;
}

/** The rows whose series, `row[seriesColumn]`, is not in `hidden`, in their order. */
export function shownRows(rows, seriesColumn, hidden) {
  return rows.filter((row) => !hidden.has(row[seriesColumn]));
}

/**
 * Place `legend`'s buttons in the legend's place above `body` (`legendPlace`), their swatches shaped `swatch` ("square" or "line"), and draw the chart
 * into `body` with `drawChart(hidden)`, nothing hidden at first. Each click on a button hides or shows its series and calls `drawChart` again with the new hidden set; a
 * chart whose every series is hidden shows a note instead, and a drawing after a click that fails shows its error in
 * `body`. A legend of fewer than two series is not placed. Settles when the first drawing has.
 */
export async function drawWithLegend(body, legend, drawChart, swatch = "square") {
  let hidden = new Set();
  if (!hasLegend(legend.series)) {
    await drawChart(hidden);
    return;
  }
  async function onToggle(name) {
    hidden = toggledSeries(hidden, name);
    try {
      await drawShownSeries(body, legend, hidden, drawChart);
    } catch (error) {
      // No one awaits a click, so the error is shown here, in the chart's place, as a failed first drawing's would be.
      showError(body, error);
    }
  }
  mountLegend(legendPlace(body), legend.series, legend.colours, hidden, onToggle, swatch);
  await drawShownSeries(body, legend, hidden, drawChart);
}

/** True when `series` (`[{ name }]`) has a series and every one is in `hidden`, so nothing is left to draw. */
export function isEverySeriesHidden(series, hidden) {
  return series.length > 0 && series.every((one) => hidden.has(one.name));
}

async function drawShownSeries(body, legend, hidden, drawChart) {
  if (isEverySeriesHidden(legend.series, hidden)) {
    showNote(body, EVERY_SERIES_HIDDEN_NOTE);
    return;
  }
  await drawChart(hidden);
}

// A legend button for `entry`, `{ label, colour, swatch }`, its swatch a square or a short line.
function legendButton(entry, isHidden, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "legend-button";
  // Pressed means shown: the button's state follows each click, as the hidden set does.
  button.setAttribute("aria-pressed", String(!isHidden));
  const swatch = document.createElement("span");
  swatch.className = entry.swatch === "line" ? "legend-swatch is-line" : "legend-swatch";
  swatch.style.background = entry.colour;
  button.append(swatch, entry.label);
  button.addEventListener("click", () => flipAndCall(button, onClick));
  return button;
}

function flipAndCall(button, onClick) {
  const isPressed = button.getAttribute("aria-pressed") === "true";
  button.setAttribute("aria-pressed", String(!isPressed));
  onClick();
}
