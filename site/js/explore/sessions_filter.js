/**
 * The sessions table's filter by month and harness, used while the Explore page's figures are frozen: the URL keys
 * `months` and `harnesses` that hold it, the keys of older links read as it, the rows it keeps, the words that say it,
 * and the folded disclosure with the month and harness pills that change it.
 *
 * A filter is `{ months, harnesses, unknown }`: the chosen months ("YYYY-MM") oldest first, the chosen harnesses in the
 * order of `harnesses.json`, and what the URL named that the data do not hold, each in words such as "month 2026-01".
 * A month is the weeks whose Sunday falls in it. `weeks` and `harnesses` below are the arrays `weeks.json` and
 * `harnesses.json` hold, as `shared/selection.js` describes them. The default filter, every month and the paper's
 * harnesses (every harness but the benchmark's), writes no key.
 */

import { formatCount, monthName } from "../shared/format.js";
import {
  defaultHarnesses, EVERY_WEEK_VALUE, isDefaultHarnessChoice, namesIn, weeksByMonth,
} from "../shared/selection.js";
import {
  choiceInFocus, controlGroup, controlsRow, harnessButtons, harnessPills, restoreFocus, togglePill,
} from "./selection_pickers.js";

// The URL keys the filter is written in.
const MONTHS_KEY = "months";
const HARNESSES_KEY = "harnesses";

// Keys of older links, read as the filter and removed when it is written: `month` names one month, `weeks` the weeks
// whose months are meant (`all` for every month), `scope` is read as the default, `harness` names one harness.
const OLDER_KEYS = Object.freeze(["month", "weeks", "scope", "harness"]);

// A choice of more months or harnesses than this is written in words as a count, such as "5 harnesses".
const MOST_NAMES_IN_WORDS = 3;

// What joins the parts of the filter's line of words.
const WORDS_SEPARATOR = " · ";

/**
 * The filter the URL names, older keys included. With no known month named, every month; with no known harness named,
 * the paper's harnesses. A `months` key wins over `month`, which wins over `weeks`.
 */
export function readTableFilter(params, weeks, harnesses) {
  const everyMonth = monthsOf(weeks);
  const namedMonths = requestedMonths(params, weeks);
  const chosenMonths = everyMonth.filter((month) => namedMonths.includes(month));
  const everyHarness = harnesses.map((entry) => entry.harness);
  const namedHarnesses = requestedHarnesses(params);
  const chosenHarnesses = everyHarness.filter((harness) => namedHarnesses.includes(harness));
  const knownSundays = weeks.map((entry) => entry.week);
  const unknown = [
    ...unknownWords("week", olderWeeks(params), knownSundays),
    ...unknownWords("month", namedMonths, everyMonth),
    ...unknownWords("harness", namedHarnesses, everyHarness),
  ];
  return {
    months: chosenMonths.length > 0 ? chosenMonths : everyMonth,
    harnesses: chosenHarnesses.length > 0 ? chosenHarnesses : defaultHarnesses(harnesses),
    unknown,
  };
}

/**
 * A copy of `params` with `filter` written in its shortest form, the older keys removed and every other key
 * untouched; a key already there keeps its place. Every month, or none, writes no `months`; the paper's harnesses, or
 * none, write no `harnesses`.
 */
export function writeTableFilter(params, filter, weeks, harnesses) {
  const written = new URLSearchParams(params);
  for (const key of OLDER_KEYS) {
    written.delete(key);
  }
  const isEveryMonth = filter.months.length === 0 || filter.months.length === monthsOf(weeks).length;
  setOrDelete(written, MONTHS_KEY, filter.months, isEveryMonth);
  const isPaperHarnesses = filter.harnesses.length === 0 || isDefaultHarnessChoice(filter.harnesses, harnesses);
  setOrDelete(written, HARNESSES_KEY, filter.harnesses, isPaperHarnesses);
  return written;
}

/** Whether `params` names a month or a harness for the filter in its own keys, `months` or `harnesses`. */
export function namesFilter(params) {
  return params.has(MONTHS_KEY) || params.has(HARNESSES_KEY);
}

/** The months of `weeks`, oldest first: each month a week's Sunday falls in, once. */
export function monthsOf(weeks) {
  return weeksByMonth(weeks).map((group) => group.month);
}

/** The rows whose week's Sunday falls in one of the filter's months and whose harness is one of its harnesses. */
export function rowsInFilter(rows, filter, weeks) {
  const chosenSundays = weeks.filter((entry) => filter.months.includes(entry.month)).map((entry) => entry.week);
  return rows.filter((row) => chosenSundays.includes(row.week) && filter.harnesses.includes(row.harness));
}

/** The note naming what the URL named that the data do not hold; "" when it named nothing unknown. */
export function unknownFilterNote(filter) {
  return filter.unknown.length === 0 ? "" : `Not in the data, so not used: ${filter.unknown.join(", ")}.`;
}

/**
 * The filter and the table's other filters in one line of words, then how many sessions match:
 * "July 2026 · codex, hermes · at least 100 requests · 128 of 12,002 sessions". `line` is
 * `{ filter, state, matching, total, weeks, harnesses }`: the filter, the table's state (`readTableState` of
 * `explore/sessions_table_state.js`), the count of sessions listed and of those in the answer, and the data arrays.
 */
export function filterWords(line) {
  const parts = [monthsWords(line.filter.months, line.weeks), harnessesWords(line.filter.harnesses, line.harnesses)];
  if (line.state.model !== "") {
    parts.push(`main model ${line.state.model}`);
  }
  if (line.state.minRequests !== null) {
    parts.push(`at least ${formatCount(line.state.minRequests)} requests`);
  }
  if (line.state.search !== "") {
    parts.push(`id containing "${line.state.search}"`);
  }
  parts.push(`${formatCount(line.matching)} of ${formatCount(line.total)} sessions`);
  return parts.join(WORDS_SEPARATOR);
}

/** The chosen months in words: "Every month", "No month", up to three month names, or a count of months. */
export function monthsWords(chosenMonths, weeks) {
  if (chosenMonths.length === monthsOf(weeks).length) {
    return "Every month";
  }
  if (chosenMonths.length === 0) {
    return "No month";
  }
  if (chosenMonths.length > MOST_NAMES_IN_WORDS) {
    return `${chosenMonths.length} months`;
  }
  return chosenMonths.map(monthName).join(", ");
}

/** The chosen harnesses in words: "the paper's harnesses", "every harness", "no harness", up to three, or a count. */
export function harnessesWords(chosenHarnesses, harnesses) {
  if (isDefaultHarnessChoice(chosenHarnesses, harnesses)) {
    return "the paper's harnesses";
  }
  if (chosenHarnesses.length === harnesses.length) {
    return "every harness";
  }
  if (chosenHarnesses.length === 0) {
    return "no harness";
  }
  if (chosenHarnesses.length > MOST_NAMES_IN_WORDS) {
    return `${chosenHarnesses.length} harnesses`;
  }
  return chosenHarnesses.join(", ");
}

/**
 * The folded filter: `{ element, line, pickers }`, a `<details>` open when `isOpen` whose summary is `line`, the
 * filter in words, followed by `pickers`, where `mountFilterPickers` draws the pills, and `controls`.
 */
export function filterDisclosure(isOpen, controls) {
  const element = document.createElement("details");
  element.className = "table-filter";
  element.open = isOpen;
  const line = document.createElement("summary");
  const pickers = document.createElement("div");
  pickers.className = "table-filter-pickers";
  element.append(line, pickers, controls);
  return { element, line, pickers };
}

/**
 * Draw in `pickers` the month pills (each month, every month) and the harness pills (each harness, every harness, the
 * paper's) for `filter`, keeping the focus. A change calls `onChange(filter)` with the filter then chosen and nothing
 * unknown, since the URL no longer names it.
 */
export function mountFilterPickers(pickers, filter, weeks, harnesses, onChange) {
  const focusedChoice = choiceInFocus(pickers);
  const everyMonth = monthsOf(weeks);
  const everyHarness = harnesses.map((entry) => entry.harness);
  const chooseMonths = (chosen) => onChange({ ...filter, months: inOrder(everyMonth, chosen), unknown: [] });
  const chooseHarnesses = (chosen) => onChange({ ...filter, harnesses: inOrder(everyHarness, chosen), unknown: [] });
  const monthControls = controlsRow();
  monthControls.append(monthPills(everyMonth, filter.months, chooseMonths));
  const harnessControls = controlsRow();
  harnessControls.append(
    harnessPills(harnesses, filter.harnesses, chooseHarnesses), harnessButtons(harnesses, chooseHarnesses),
  );
  pickers.replaceChildren(monthControls, harnessControls);
  restoreFocus(pickers, focusedChoice);
}

/** One pill per month of `everyMonth`, then "All months", each calling `onChoose(months)` with the months chosen. */
function monthPills(everyMonth, chosenMonths, onChoose) {
  const element = controlGroup("Months");
  for (const month of everyMonth) {
    element.append(togglePill(chosenMonths, [month], monthName(month), `month ${month}`, onChoose));
  }
  element.append(togglePill(chosenMonths, everyMonth, "All months", "all months", onChoose));
  return element;
}

/** The values of `values` that `chosen` holds, in the order of `values`. */
function inOrder(values, chosen) {
  return values.filter((value) => chosen.includes(value));
}

/** The months the URL asks for: those `months` or `month` names, or the months of the known weeks `weeks` names. */
function requestedMonths(params, weeks) {
  if (params.has(MONTHS_KEY)) {
    return namesIn(params.get(MONTHS_KEY));
  }
  if (params.has("month")) {
    return namesIn(params.get("month"));
  }
  const sundays = olderWeeks(params);
  return monthsOf(weeks.filter((entry) => sundays.includes(entry.week)));
}

/** The Sundays an older `weeks` key names when no `months` or `month` key is read instead; none for `weeks=all`. */
function olderWeeks(params) {
  const value = params.get("weeks");
  if (params.has(MONTHS_KEY) || params.has("month") || value === null || value === EVERY_WEEK_VALUE) {
    return [];
  }
  return namesIn(value);
}

/** The harnesses the URL asks for: those `harnesses` names, or the one an older `harness` key names. */
function requestedHarnesses(params) {
  if (params.has(HARNESSES_KEY)) {
    return namesIn(params.get(HARNESSES_KEY));
  }
  return namesIn(params.get("harness") ?? "");
}

/** Write `names` to `params` under `key`, comma-separated, or remove the key when they are the default. */
function setOrDelete(params, key, names, isDefault) {
  if (isDefault) {
    params.delete(key);
  } else {
    params.set(key, names.join(","));
  }
}

/** Each of `named` that `known` does not hold, once, in words: "month 2026-01". */
function unknownWords(kind, named, known) {
  const unknown = new Set(named.filter((name) => !known.includes(name)));
  return [...unknown].map((name) => `${kind} ${name}`);
}
