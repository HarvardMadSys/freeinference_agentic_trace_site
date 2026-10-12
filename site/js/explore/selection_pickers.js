/**
 * The selection section of the Explore page: the week picker (each week, each month, every week),
 * the harness picker (each harness, every harness, the paper's harnesses), and the notes under them; and the pills,
 * groups and buttons they are built of, which the sessions table's filter is built of too.
 *
 * `weeks` and `harnesses` are the entries of `weeks.json` and `harnesses.json`; a selection is as `shared/selection.js`
 * defines it.
 */

import { formatCount, monthName } from "../shared/format.js";
import {
  computationNote, defaultHarnesses, streamedWeeksNote, streamedWeeksText, unknownSelectionNote, weeksByMonth,
} from "../shared/selection.js";

// The class of the words in the computation note that count the weeks streamed in, rewritten as each week arrives.
const STREAMED_WEEKS_CLASS = "streamed-weeks";

/**
 * Draw the week picker, the harness picker and the notes under them in `container`. Every change redraws them and
 * calls `onChange(selection)`; unticking the last week or harness gives a selection with none. `streamedWeeks()`
 * returns the Sundays the page has streamed in so far, or null when it does not stream.
 */
export function mountSelection(container, weeks, harnesses, selection, onChange, streamedWeeks = () => null) {
  const picker = { container, weeks, harnesses, selection, onChange, streamedWeeks };
  const focusedChoice = choiceInFocus(container);
  const weekControls = controlsRow();
  for (const group of weeksByMonth(weeks)) {
    weekControls.append(monthGroup(picker, group));
  }
  weekControls.append(everyWeekGroup(picker));
  const harnessControls = controlsRow();
  const chooseHarnesses = (chosen) => choose(picker, picker.selection.weeks, chosen);
  harnessControls.append(
    harnessPills(harnesses, selection.harnesses, chooseHarnesses), harnessButtons(harnesses, chooseHarnesses),
  );
  container.replaceChildren(weekControls, harnessControls, ...notes(picker));
  restoreFocus(container, focusedChoice);
}

/** Rewrite the count of weeks streamed in, in the pickers drawn in `container`, if their note shows it. */
export function showStreamedWeeks(container, streamedWeeks, weeks) {
  const count = container.querySelector(`.${STREAMED_WEEKS_CLASS}`);
  if (count !== null) {
    count.textContent = streamedWeeksText(streamedWeeks, weeks);
  }
}

/**
 * The notes under the pickers: the URL's unknown names, and where the numbers come from with the weeks streamed in.
 * `picker`, here and in the functions below, is `{ container, weeks, harnesses, selection, onChange, streamedWeeks }`:
 * what one drawing of the pickers was given.
 */
function notes(picker) {
  const elements = [];
  const unknown = unknownSelectionNote(picker.selection);
  if (unknown !== "") {
    elements.push(note(unknown));
  }
  const computation = computationNote(picker.selection, picker.weeks, picker.harnesses);
  if (computation !== "") {
    const element = note(computation);
    const streamed = streamedWeeksNote(picker.selection, picker.weeks, picker.harnesses, picker.streamedWeeks());
    if (streamed !== "") {
      const count = document.createElement("span");
      count.className = STREAMED_WEEKS_CLASS;
      count.textContent = streamed;
      element.append(" ", count);
    }
    elements.push(element);
  }
  return elements;
}

function monthGroup(picker, group) {
  const element = controlGroup(monthName(group.month));
  const monthWeeks = group.weeks.map((entry) => entry.week);
  element.append(weeksPill(picker, monthWeeks, monthName(group.month), `month ${group.month}`));
  for (const entry of group.weeks) {
    const pill = weeksPill(picker, [entry.week], dayName(entry.week), `week ${entry.week}`);
    pill.title = `${entry.week} to ${entry.last_day}`;
    element.append(pill);
  }
  return element;
}

function everyWeekGroup(picker) {
  const element = controlGroup("Every week");
  element.append(weeksPill(picker, picker.weeks.map((entry) => entry.week), "All weeks", "all weeks"));
  return element;
}

/**
 * One checkbox pill per harness of `harnesses`, labelled with its sessions over every week, the benchmark's marked;
 * ticking or unticking one calls `onChoose(harnesses)` with the harnesses then chosen. With `keepsOne`, the last
 * harness chosen cannot be unticked.
 */
export function harnessPills(harnesses, chosenHarnesses, onChoose, keepsOne = false) {
  const element = controlGroup("Harnesses");
  for (const entry of harnesses) {
    const input = choiceBox(`harness ${entry.harness}`, chosenHarnesses.includes(entry.harness));
    input.disabled = keepsOne && leavesNoneChosen(chosenHarnesses, [entry.harness]);
    const chosen = toggled(chosenHarnesses, [entry.harness]);
    input.addEventListener("change", () => onChoose(chosen));
    const label = pill(input, `${entry.harness} (${formatCount(entry.sessions)})`);
    if (entry.benchmark) {
      label.append(markText("benchmark replay"));
    }
    element.append(label);
  }
  return element;
}

/** The buttons that choose every harness, or the paper's, at once, each calling `onChoose(harnesses)`. */
export function harnessButtons(harnesses, onChoose) {
  const element = controlGroup("Harnesses at once");
  const everyHarness = harnesses.map((entry) => entry.harness);
  const paperHarnesses = defaultHarnesses(harnesses);
  element.append(
    actionButton("every harness", () => onChoose(everyHarness)),
    actionButton("the paper's harnesses", () => onChoose(paperHarnesses)),
  );
  return element;
}

/**
 * A checkbox pill that toggles `pillValues` among `chosenValues`: ticked when all are chosen, half-ticked when some
 * are; a change calls `onChoose(values)` with the values then chosen. `choice` names the pill to keep its focus. With
 * `keepsOne`, a pill whose unticking would leave nothing chosen cannot be unticked.
 */
export function togglePill(chosenValues, pillValues, text, choice, onChoose, keepsOne = false) {
  const chosenCount = pillValues.filter((value) => chosenValues.includes(value)).length;
  const input = choiceBox(choice, chosenCount === pillValues.length);
  input.indeterminate = chosenCount > 0 && chosenCount < pillValues.length;
  input.disabled = keepsOne && leavesNoneChosen(chosenValues, pillValues);
  const chosen = toggled(chosenValues, pillValues);
  input.addEventListener("change", () => onChoose(chosen));
  return pill(input, text);
}

/** The `data-choice` of the control in focus in `container`, for a redrawing to give back; undefined for none. */
export function choiceInFocus(container) {
  const focused = document.activeElement;
  return focused !== null && container.contains(focused) ? focused.dataset.choice : undefined;
}

/** Focus the control of `container` whose `data-choice` is `choice`, if there is one. */
export function restoreFocus(container, choice) {
  if (choice !== undefined) {
    container.querySelector(`[data-choice="${CSS.escape(choice)}"]`)?.focus();
  }
}

/** A pill that toggles `pillWeeks` in the selection, keeping its harnesses. */
function weeksPill(picker, pillWeeks, text, choice) {
  const chooseWeeks = (chosen) => choose(picker, chosen, picker.selection.harnesses);
  return togglePill(picker.selection.weeks, pillWeeks, text, choice, chooseWeeks);
}

function choiceBox(choice, isChecked) {
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.choice = choice;
  input.checked = isChecked;
  return input;
}

function pill(input, text) {
  const element = document.createElement("label");
  element.className = input.checked ? "pill is-selected" : "pill";
  element.append(input, text);
  return element;
}

function markText(text) {
  const element = document.createElement("span");
  element.className = "pill-mark";
  element.textContent = text;
  return element;
}

function actionButton(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.choice = text;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

/**
 * Whether a click on the pill of `pillValues` would leave none of `chosenValues` chosen: the pill is ticked, so the
 * click unticks it, and it holds every chosen value.
 */
export function leavesNoneChosen(chosenValues, pillValues) {
  const isTicked = pillValues.every((value) => chosenValues.includes(value));
  return isTicked && chosenValues.every((value) => pillValues.includes(value));
}

/** A row of controls that wraps. */
export function controlsRow() {
  const element = document.createElement("div");
  element.className = "controls";
  return element;
}

/** A group of controls named `name` for a screen reader. */
export function controlGroup(name) {
  const element = document.createElement("div");
  element.className = "control-group";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", name);
  return element;
}

/** A note, in the muted box notes are shown in. */
export function note(text) {
  const element = document.createElement("p");
  element.className = "note";
  element.textContent = text;
  return element;
}

/** Remove `values` from `selectedValues` when all are selected; otherwise add the missing ones. */
function toggled(selectedValues, values) {
  if (values.every((value) => selectedValues.includes(value))) {
    return selectedValues.filter((value) => !values.includes(value));
  }
  return [...new Set([...selectedValues, ...values])];
}

function choose(picker, chosenWeeks, chosenHarnesses) {
  const next = {
    weeks: picker.weeks.map((entry) => entry.week).filter((week) => chosenWeeks.includes(week)),
    harnesses: picker.harnesses.map((entry) => entry.harness).filter((harness) => chosenHarnesses.includes(harness)),
    // After a change the URL no longer names what was unknown.
    unknownWeeks: [],
    unknownMonth: null,
    unknownHarnesses: [],
  };
  mountSelection(picker.container, picker.weeks, picker.harnesses, next, picker.onChange, picker.streamedWeeks);
  picker.onChange(next);
}

/** "2026-05-31" → "May 31". */
function dayName(sunday) {
  const day = new Date(`${sunday}T00:00:00Z`);
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
