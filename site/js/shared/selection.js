/**
 * The selection of weeks and harnesses a page shows, the URL keys `weeks`, `month` and `harnesses` that hold it, and
 * the notes and caption text that describe it. The pickers that change it are in `explore/selection_pickers.js`.
 *
 * A selection is `{ weeks, harnesses, unknownWeeks, unknownMonth, unknownHarnesses }`: the selected Sundays oldest
 * first, the selected harnesses in the order of `harnesses.json`, the weeks and harnesses the URL named that the data
 * do not hold, and the month the URL named that holds no week (or null). `weeks` below is the array `weeks.json`
 * holds, oldest first: `{ week, last_day, month, simulated }`; `harnesses` is the array `harnesses.json` holds, most
 * sessions first: `{ harness, sessions, benchmark }`. The default selection is every week and every harness but the
 * benchmark, which is the paper's population; it writes no key to the URL. While the Explore page's figures are frozen,
 * the URL's keys filter the sessions table instead, as `explore/sessions_filter.js` reads them.
 */

// A value of the URL key `weeks` that selects every week, as no key does; it is read, never written.
export const EVERY_WEEK_VALUE = "all";

// The URL keys writing a selection replaces: its own three, and `scope`, which is read as the default and so removed.
const SELECTION_KEYS = Object.freeze(["weeks", "month", "harnesses", "scope"]);

// The note under the pickers while the selection is the default.
const DEFAULT_SELECTION_NOTE = "Every week and the paper's harnesses: precomputed.";

// The note under the pickers for any other selection, which DuckDB computes in the page.
const COMPUTED_SELECTION_NOTE = "Computed in your browser; a narrowed selection may take a few seconds.";

/** The selection the URL names; with no known week named, every week; with no known harness named, the default ones. */
export function readSelection(params, weeks, harnesses) {
  const requested = requestedWeeks(params, weeks);
  const knownWeeks = weeks.map((entry) => entry.week);
  const selectedWeeks = knownWeeks.filter((week) => requested.includes(week));
  const named = namedHarnesses(params);
  const knownHarnesses = harnesses.map((entry) => entry.harness);
  const selectedHarnesses = knownHarnesses.filter((harness) => named.includes(harness));
  return {
    weeks: selectedWeeks.length > 0 ? selectedWeeks : knownWeeks,
    harnesses: selectedHarnesses.length > 0 ? selectedHarnesses : defaultHarnesses(harnesses),
    unknownWeeks: unique(requested.filter((week) => !knownWeeks.includes(week))),
    unknownMonth: unknownMonth(params, weeks),
    unknownHarnesses: unique(named.filter((harness) => !knownHarnesses.includes(harness))),
  };
}

/** The default selection: every week of `weeks.json` and the default harnesses, nothing unknown asked for. */
export function defaultSelection(weeks, harnesses) {
  return {
    weeks: weeks.map((entry) => entry.week),
    harnesses: defaultHarnesses(harnesses),
    unknownWeeks: [],
    unknownMonth: null,
    unknownHarnesses: [],
  };
}

/** The harnesses selected by default: every harness of `harnesses.json` but the benchmark, in its order. */
export function defaultHarnesses(harnesses) {
  return harnesses.filter((entry) => !entry.benchmark).map((entry) => entry.harness);
}

/** Whether the selection is the default: every week, and exactly the default harnesses. */
export function isDefaultSelection(selection, weeks, harnesses) {
  return holdsAllWeeks(selection.weeks, weeks) && isDefaultHarnessChoice(selection.harnesses, harnesses);
}

/** Whether `selectedHarnesses` are exactly the default harnesses, in any order. */
export function isDefaultHarnessChoice(selectedHarnesses, harnesses) {
  return sameMembers(selectedHarnesses, defaultHarnesses(harnesses));
}

/**
 * A copy of `params` with the selection written in its shortest form and every other key untouched. Every week
 * selected, or none, writes neither `weeks` nor `month`; the default harnesses, or none, write no `harnesses`; a
 * `scope` key is dropped. A URL without these keys opens on the default.
 */
export function writeSelection(params, selection, weeks, harnesses) {
  const written = withoutSelection(params);
  if (selection.weeks.length > 0 && !holdsAllWeeks(selection.weeks, weeks)) {
    writeWeeks(written, selection.weeks, weeks);
  }
  if (selection.harnesses.length > 0 && !isDefaultHarnessChoice(selection.harnesses, harnesses)) {
    written.set("harnesses", selection.harnesses.join(","));
  }
  return written;
}

/** A copy of `params` without the keys a selection is written in (`weeks`, `month`, `harnesses`, `scope`). */
export function withoutSelection(params) {
  const kept = new URLSearchParams(params);
  for (const key of SELECTION_KEYS) {
    kept.delete(key);
  }
  return kept;
}

/** The query string of `params` for the address bar: "?" and the keys, commas left plain; "" for no keys. */
export function selectionQuery(params) {
  // A comma needs no escaping in a query string and reads back the same, so `weeks=a,b` stays readable.
  const query = params.toString().replaceAll("%2C", ",");
  return query === "" ? "" : `?${query}`;
}

/** The note naming the weeks, month and harnesses the URL asked for that the data do not hold; "" when it named none. */
export function unknownSelectionNote(selection) {
  const unknown = [...selection.unknownWeeks];
  if (selection.unknownMonth !== null) {
    unknown.push(`month ${selection.unknownMonth}`);
  }
  for (const harness of selection.unknownHarnesses) {
    unknown.push(`harness ${harness}`);
  }
  return unknown.length === 0 ? "" : `Not in the data, so not selected: ${unknown.join(", ")}.`;
}

/**
 * The note saying where the selection's numbers come from: precomputed for the default, the browser otherwise; "" when
 * no week or no harness is selected, since there are no numbers.
 */
export function computationNote(selection, weeks, harnesses) {
  if (selection.weeks.length === 0 || selection.harnesses.length === 0) {
    return "";
  }
  return isDefaultSelection(selection, weeks, harnesses) ? DEFAULT_SELECTION_NOTE : COMPUTED_SELECTION_NOTE;
}

/**
 * The words appended to the computation note while the page streams the weeks' rows in: "The newest 3 of 16 weeks
 * loaded in your browser." for a selection DuckDB computes; "" for the default selection, with nothing selected, or when the page
 * does not stream (`streamedWeeks` null). `streamedWeeks` holds the Sundays streamed in so far.
 */
export function streamedWeeksNote(selection, weeks, harnesses, streamedWeeks) {
  const isComputed = computationNote(selection, weeks, harnesses) === COMPUTED_SELECTION_NOTE;
  return isComputed && streamedWeeks !== null ? streamedWeeksText(streamedWeeks, weeks) : "";
}

/**
 * How many of the weeks of `weeks` are among `streamedWeeks`, and which: "The newest 3 of 16 weeks loaded in your
 * browser.", or "0 of 16 weeks …" and "16 of 16 weeks …" when none or all are in. The stream fetches the newest week
 * first, so the weeks in are the newest.
 */
export function streamedWeeksText(streamedWeeks, weeks) {
  const loaded = weeks.filter((entry) => streamedWeeks.includes(entry.week)).length;
  if (loaded === 0 || loaded === weeks.length) {
    return `${loaded} of ${weeks.length} weeks loaded in your browser.`;
  }
  return `The newest ${loaded} of ${weeks.length} weeks loaded in your browser.`;
}

/** The harnesses a caption names: "the paper's harnesses", "every harness", the one harness, or "3 harnesses". */
export function harnessesText(selectedHarnesses, harnesses) {
  if (isDefaultHarnessChoice(selectedHarnesses, harnesses)) {
    return "the paper's harnesses";
  }
  if (selectedHarnesses.length === harnesses.length) {
    return "every harness";
  }
  return selectedHarnesses.length === 1 ? selectedHarnesses[0] : `${selectedHarnesses.length} harnesses`;
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

/** The comma-separated names of a URL value, each trimmed, empty ones dropped. */
export function namesIn(value) {
  return value.split(",").map((name) => name.trim()).filter((name) => name !== "");
}

function requestedWeeks(params, weeks) {
  const named = params.get("weeks");
  if (named === EVERY_WEEK_VALUE) {
    return weeks.map((entry) => entry.week);
  }
  if (named !== null) {
    return namesIn(named);
  }
  const month = params.get("month");
  if (month !== null) {
    return weeks.filter((entry) => entry.month === month).map((entry) => entry.week);
  }
  return [];
}

function namedHarnesses(params) {
  const named = params.get("harnesses");
  return named === null ? [] : namesIn(named);
}

function unknownMonth(params, weeks) {
  const month = params.get("month");
  if (params.has("weeks") || month === null || month === "") {
    return null;
  }
  return weeks.some((entry) => entry.month === month) ? null : month;
}

function unique(values) {
  return [...new Set(values)];
}

function holdsAll(selectedValues, someValues) {
  return someValues.every((value) => selectedValues.includes(value));
}

function holdsAllWeeks(selectedWeeks, weeks) {
  return holdsAll(selectedWeeks, weeks.map((entry) => entry.week));
}

function sameMembers(first, second) {
  return first.length === second.length && holdsAll(first, second);
}

function writeWeeks(written, selectedWeeks, weeks) {
  const month = wholeMonth(selectedWeeks, weeks);
  if (month !== null) {
    written.set("month", month);
  } else {
    written.set("weeks", selectedWeeks.join(","));
  }
}

function wholeMonth(selectedWeeks, weeks) {
  for (const group of weeksByMonth(weeks)) {
    if (sameMembers(selectedWeeks, group.weeks.map((entry) => entry.week))) {
      return group.month;
    }
  }
  return null;
}
