/**
 * The week picker, the scope switch, and the URL keys `weeks`, `month` and `scope` that hold their choice.
 *
 * A selection is `{ weeks, scope, unknownWeeks }`: the selected Sundays oldest first, one scope, and the
 * weeks the URL named that `weeks.json` does not hold. `weeks` below is the array `weeks.json` holds,
 * oldest first: `{ week, last_day, month, simulated }`.
 */

// The scope a page shows when the URL names none, or names one that does not exist.
const DEFAULT_SCOPE = "Agentic";

// Each scope a visitor can choose, with the scopes of the data it covers.
const SCOPE_MEMBERS = {
  Agentic: ["Agentic"],
  "SWE-Bench": ["SWE-Bench"],
  All: ["Agentic", "SWE-Bench"],
};

// The value of the URL key `weeks` that selects every week.
const ALL_WEEKS = "all";

/** The selection the URL names; with no valid week named, the latest week. */
export function readSelection(params, weeks) {
  const requested = requestedWeeks(params, weeks);
  const known = weeks.map((entry) => entry.week);
  const selected = known.filter((week) => requested.includes(week));
  return {
    weeks: selected.length > 0 ? selected : latestWeek(weeks),
    scope: chosenScope(params),
    unknownWeeks: unique(requested.filter((week) => !known.includes(week))),
  };
}

/** A copy of `params` with the selection written in its shortest form and every other key untouched. */
export function writeSelection(params, selection, weeks) {
  const written = new URLSearchParams(params);
  written.delete("weeks");
  written.delete("month");
  written.delete("scope");
  const month = wholeMonth(selection.weeks, weeks);
  if (holdsAll(selection.weeks, weeks.map((entry) => entry.week))) {
    written.set("weeks", ALL_WEEKS);
  } else if (month !== null) {
    written.set("month", month);
  } else {
    written.set("weeks", selection.weeks.join(","));
  }
  if (selection.scope !== DEFAULT_SCOPE) {
    written.set("scope", selection.scope);
  }
  return written;
}

/** The scopes of the data a chosen scope covers: what fills `selected_scopes`. */
export function scopesOf(scope) {
  return [...SCOPE_MEMBERS[scope]];
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
 * Draw the week picker and scope switch in `container`.
 * Every change redraws them and calls `onChange(selection)`; a change that would leave no week selected is refused.
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

function chosenScope(params) {
  const scope = params.get("scope");
  return Object.hasOwn(SCOPE_MEMBERS, scope) ? scope : DEFAULT_SCOPE;
}

function unique(values) {
  return [...new Set(values)];
}

function holdsAll(selectedWeeks, someWeeks) {
  return someWeeks.every((week) => selectedWeeks.includes(week));
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
    unknownWeeks: [],
  };
  if (next.weeks.length === 0) {
    // At least one week stays selected: redraw the unchanged selection, which re-ticks the pill.
    mountSelection(picker.container, picker.weeks, picker.selection, picker.onChange);
    return;
  }
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

function monthName(month) {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function dayName(sunday) {
  return new Date(`${sunday}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
