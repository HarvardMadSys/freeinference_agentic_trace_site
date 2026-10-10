/**
 * The week picker, the scope switch, and the URL keys `weeks`, `month` and `scope` that hold their choice.
 *
 * A selection is `{ weeks, scope, unknownWeeks, unknownMonth }`: the selected Sundays oldest first, one
 * scope, the weeks the URL named that `weeks.json` does not hold, and the month the URL named that holds
 * no week (or null). `weeks` below is the array `weeks.json` holds, oldest first:
 * `{ week, last_day, month, simulated }`.
 */

// The scope a page shows when the URL names none, or names one that does not exist.
const DEFAULT_SCOPE = "Agentic";

// Each scope a visitor can choose, with the scopes of the data it covers; the pipeline's scopes, checked by
// tests/test_pipeline_mirrors.py.
const SCOPE_MEMBERS = Object.freeze({
  Agentic: ["Agentic"],
  "SWE-Bench": ["SWE-Bench"],
  All: ["Agentic", "SWE-Bench"],
});

// The value of the URL key `weeks` that selects every week.
const ALL_WEEKS = "all";

/** The selection the URL names; with no valid week named, the latest week. */
export function readSelection(params, weeks) {
  const requested = requestedWeeks(params, weeks);
  const known = weeks.map((entry) => entry.week);
  const selected = known.filter((week) => requested.includes(week));
  return {
    weeks: selected.length > 0 ? selected : latestWeek(weeks),
    scope: knownScope(params.get("scope")),
    unknownWeeks: unique(requested.filter((week) => !known.includes(week))),
    unknownMonth: unknownMonth(params, weeks),
  };
}

/**
 * A copy of `params` with the selection written in its shortest form and every other key untouched.
 * A selection with no week writes neither `weeks` nor `month`, so the URL opens on the default.
 */
export function writeSelection(params, selection, weeks) {
  const written = new URLSearchParams(params);
  written.delete("weeks");
  written.delete("month");
  written.delete("scope");
  if (selection.weeks.length > 0) {
    writeWeeks(written, selection.weeks, weeks);
  }
  if (selection.scope !== DEFAULT_SCOPE) {
    written.set("scope", selection.scope);
  }
  return written;
}

/** The query string of `params` for the address bar: "?" and the keys, commas left plain; "" for no keys. */
export function selectionQuery(params) {
  // A comma needs no escaping in a query string and reads back the same, so `weeks=a,b` stays readable.
  const query = params.toString().replaceAll("%2C", ",");
  return query === "" ? "" : `?${query}`;
}

/** The scopes of the data a chosen scope covers: what fills `selected_scopes`; an unknown scope covers the default's. */
export function scopesOf(scope) {
  return [...SCOPE_MEMBERS[knownScope(scope)]];
}

/** The note naming the weeks and the month the URL asked for that `weeks.json` does not hold; "" when it named none. */
export function unknownSelectionNote(selection) {
  const unknown = [...selection.unknownWeeks];
  if (selection.unknownMonth !== null) {
    unknown.push(`month ${selection.unknownMonth}`);
  }
  return unknown.length === 0 ? "" : `Not in the data, so not selected: ${unknown.join(", ")}.`;
}

/** The weeks grouped by the month of their Sunday, months oldest first: `[{ month, weeks: [entry…] }]`. */
export function weeksByMonth(weeks) {
  const groups = [];
  for (const entry of weeks) {
    const last = groups.at(-1);
    if (last !== undefined && last.month === entry.month) {
      last.weeks.push(entry);
    } else {
      groups.push({ month: entry.month, weeks: [entry] });
    }
  }
  return groups;
}

/**
 * Draw the week picker and scope switch in `container`, with `unknownSelectionNote` under them when it has one.
 * Every change redraws them and calls `onChange(selection)`; unticking the last week gives a selection with no week.
 */
export function mountSelection(container, weeks, selection, onChange) {
  const picker = { container, weeks, selection, onChange };
  const focusedChoice = choiceInFocus(container);
  const weekControls = document.createElement("div");
  weekControls.className = "controls";
  for (const group of weeksByMonth(weeks)) {
    weekControls.append(monthGroup(picker, group));
  }
  weekControls.append(allWeeksGroup(picker));
  container.replaceChildren(weekControls, scopeGroup(picker));
  const note = document.createElement("p");
  note.className = "note";
  note.textContent = unknownSelectionNote(selection);
  if (note.textContent !== "") {
    container.append(note);
  }
  restoreFocus(container, focusedChoice);
}

function requestedWeeks(params, weeks) {
  const named = params.get("weeks");
  if (named === ALL_WEEKS) {
    return weeks.map((entry) => entry.week);
  }
  if (named !== null) {
    return named.split(",").map((week) => week.trim()).filter((week) => week !== "");
  }
  const month = params.get("month");
  if (month !== null) {
    return weeks.filter((entry) => entry.month === month).map((entry) => entry.week);
  }
  return [];
}

function latestWeek(weeks) {
  return weeks.slice(-1).map((entry) => entry.week);
}

function unknownMonth(params, weeks) {
  const month = params.get("month");
  if (params.has("weeks") || month === null || month === "") {
    return null;
  }
  return weeks.some((entry) => entry.month === month) ? null : month;
}

function knownScope(scope) {
  return Object.hasOwn(SCOPE_MEMBERS, scope) ? scope : DEFAULT_SCOPE;
}

function unique(values) {
  return [...new Set(values)];
}

function holdsAll(selectedWeeks, someWeeks) {
  return someWeeks.every((week) => selectedWeeks.includes(week));
}

function writeWeeks(written, selectedWeeks, weeks) {
  const month = wholeMonth(selectedWeeks, weeks);
  if (holdsAll(selectedWeeks, weeks.map((entry) => entry.week))) {
    written.set("weeks", ALL_WEEKS);
  } else if (month !== null) {
    written.set("month", month);
  } else {
    written.set("weeks", selectedWeeks.join(","));
  }
}

function wholeMonth(selectedWeeks, weeks) {
  for (const group of weeksByMonth(weeks)) {
    const monthWeeks = group.weeks.map((entry) => entry.week);
    if (monthWeeks.length === selectedWeeks.length && holdsAll(selectedWeeks, monthWeeks)) {
      return group.month;
    }
  }
  return null;
}

// ---------- The picker ----------
// `picker` is `{ container, weeks, selection, onChange }`: what one drawing of the picker was given.

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

function allWeeksGroup(picker) {
  const element = controlGroup("Every week");
  const allWeeks = picker.weeks.map((entry) => entry.week);
  element.append(weeksPill(picker, allWeeks, "All weeks", "all weeks"));
  return element;
}

function scopeGroup(picker) {
  const element = controlGroup("Scope");
  const label = document.createElement("span");
  label.className = "control-label";
  label.textContent = "Scope";
  element.append(label);
  for (const scope of Object.keys(SCOPE_MEMBERS)) {
    element.append(scopePill(picker, scope));
  }
  return element;
}

/** A checkbox pill that toggles `pillWeeks`: ticked when all are selected, half-ticked when some are. */
function weeksPill(picker, pillWeeks, text, choice) {
  const selectedCount = pillWeeks.filter((week) => picker.selection.weeks.includes(week)).length;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.dataset.choice = choice;
  input.checked = selectedCount === pillWeeks.length;
  input.indeterminate = selectedCount > 0 && selectedCount < pillWeeks.length;
  const toggledWeeks = toggled(picker.selection.weeks, pillWeeks);
  input.addEventListener("change", () => choose(picker, toggledWeeks, picker.selection.scope));
  return pill(input, text);
}

function scopePill(picker, scope) {
  const input = document.createElement("input");
  input.type = "radio";
  input.name = "scope";
  input.dataset.choice = `scope ${scope}`;
  input.checked = picker.selection.scope === scope;
  input.addEventListener("change", () => choose(picker, picker.selection.weeks, scope));
  return pill(input, scope);
}

function pill(input, text) {
  const element = document.createElement("label");
  element.className = input.checked ? "pill is-selected" : "pill";
  element.append(input, text);
  return element;
}

function controlGroup(name) {
  const element = document.createElement("div");
  element.className = "control-group";
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", name);
  return element;
}

/** Remove `pillWeeks` from the selection when all are selected; otherwise add the missing ones. */
function toggled(selectedWeeks, pillWeeks) {
  if (holdsAll(selectedWeeks, pillWeeks)) {
    return selectedWeeks.filter((week) => !pillWeeks.includes(week));
  }
  return unique([...selectedWeeks, ...pillWeeks]);
}

function choose(picker, chosenWeeks, scope) {
  const next = {
    weeks: picker.weeks.map((entry) => entry.week).filter((week) => chosenWeeks.includes(week)),
    scope,
    // After a change the URL no longer names what was unknown.
    unknownWeeks: [],
    unknownMonth: null,
  };
  mountSelection(picker.container, picker.weeks, next, picker.onChange);
  picker.onChange(next);
}

function choiceInFocus(container) {
  const focused = document.activeElement;
  return focused !== null && container.contains(focused) ? focused.dataset.choice : undefined;
}

function restoreFocus(container, choice) {
  if (choice !== undefined) {
    container.querySelector(`[data-choice="${CSS.escape(choice)}"]`)?.focus();
  }
}

/** "2026-05" → "May 2026". */
function monthName(month) {
  const firstDay = new Date(`${month}-01T00:00:00Z`);
  return firstDay.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** "2026-05-31" → "May 31". */
function dayName(sunday) {
  const day = new Date(`${sunday}T00:00:00Z`);
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
