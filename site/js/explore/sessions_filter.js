/**
 * The sessions table's filter by month and harness, used while the Explore page's figures are frozen: the URL keys
 * `months` and `harnesses` that hold it, the keys of older links read as it, the rows it keeps, and the choices of the
 * month and harness drop-downs that change it.
 *
 * A filter is `{ month, harness, unknown }`: the chosen month ("YYYY-MM"), or "" for every month; the chosen harness,
 * or "" for every harness, the benchmark's included; and what the URL named that the data do not hold, each in words
 * such as "month 2026-01". A month is the weeks whose Sunday falls in it. `weeks` and `harnesses` below are the arrays
 * `weeks.json` and `harnesses.json` hold, as `shared/selection.js` describes them. The default filter, every month and
 * every harness, writes no key.
 */

import { monthName } from "../shared/format.js";
import { EVERY_WEEK_VALUE, namesIn, weeksByMonth } from "../shared/selection.js";
import { harnessText } from "./sessions_table_state.js";

// The URL keys the filter is written in, one value each.
const MONTHS_KEY = "months";
const HARNESSES_KEY = "harnesses";

// Keys of older links, read as the filter and removed when it is written: `month` names one month, `weeks` the weeks
// whose months are meant (`all` for every month), `scope` is read as the default, `harness` names one harness.
const OLDER_KEYS = Object.freeze(["month", "weeks", "scope", "harness"]);

// The text of the month drop-down's first choice, which filters nothing.
const EVERY_MONTH_TEXT = "All months";

/** The text of a harness drop-down's first choice, which filters nothing. */
export const EVERY_HARNESS_TEXT = "All harnesses";

/**
 * The filter the URL names, older keys included. A key naming several months or harnesses keeps the first the data
 * hold; with none known, every month or every harness. A `months` key wins over `month`, which wins over `weeks`.
 */
export function readTableFilter(params, weeks, harnesses) {
  const everyMonth = monthsOf(weeks);
  const namedMonths = requestedMonths(params, weeks);
  const everyHarness = harnesses.map((entry) => entry.harness);
  const namedHarnesses = requestedHarnesses(params);
  const knownSundays = weeks.map((entry) => entry.week);
  const unknown = [
    ...unknownWords("week", olderWeeks(params), knownSundays),
    ...unknownWords("month", namedMonths, everyMonth),
    ...unknownWords("harness", namedHarnesses, everyHarness),
  ];
  return { month: firstKnown(namedMonths, everyMonth), harness: firstKnown(namedHarnesses, everyHarness), unknown };
}

/**
 * A copy of `params` with `filter` written, the older keys removed and every other key untouched; a key already there
 * keeps its place. Every month writes no `months`, every harness no `harnesses`.
 */
export function writeTableFilter(params, filter) {
  const written = new URLSearchParams(params);
  for (const key of OLDER_KEYS) {
    written.delete(key);
  }
  setOrDelete(written, MONTHS_KEY, filter.month);
  setOrDelete(written, HARNESSES_KEY, filter.harness);
  return written;
}

/** The months of `weeks`, oldest first: each month a week's Sunday falls in, once. */
export function monthsOf(weeks) {
  return weeksByMonth(weeks).map((group) => group.month);
}

/** The rows whose week's Sunday falls in the filter's month, and whose harness is its harness; "" keeps every one. */
export function rowsInFilter(rows, filter, weeks) {
  const monthSundays = weeks.filter((entry) => entry.month === filter.month).map((entry) => entry.week);
  const kept = [];
  for (const row of rows) {
    const isInMonth = filter.month === "" || monthSundays.includes(row.week);
    const isOfHarness = filter.harness === "" || row.harness === filter.harness;
    if (isInMonth && isOfHarness) {
      kept.push(row);
    }
  }
  return kept;
}

/** The month drop-down's choices, `[{ value, text }]`: "All months" (value ""), then each month oldest first by name. */
export function monthChoices(weeks) {
  const months = [{ value: "", text: EVERY_MONTH_TEXT }];
  for (const month of monthsOf(weeks)) {
    months.push({ value: month, text: monthName(month) });
  }
  return months;
}

/**
 * The harness drop-down's choices, `[{ value, text }]`: "All harnesses" (value ""), then each harness in the order of
 * `harnesses.json`, the benchmark's named "swe-bench (benchmark)".
 */
export function harnessChoices(harnesses) {
  const choices = [{ value: "", text: EVERY_HARNESS_TEXT }];
  for (const entry of harnesses) {
    const text = entry.benchmark ? `${harnessText(entry.harness)} (benchmark)` : harnessText(entry.harness);
    choices.push({ value: entry.harness, text });
  }
  return choices;
}

/** The note naming what the URL named that the data do not hold; "" when it named nothing unknown. */
export function unknownFilterNote(filter) {
  return filter.unknown.length === 0 ? "" : `Not in the data, so not used: ${filter.unknown.join(", ")}.`;
}

/** The first of `named` that `known` holds, or "" when it holds none. */
function firstKnown(named, known) {
  return named.find((name) => known.includes(name)) ?? "";
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

/** Write `value` to `params` under `key`, or remove the key when `value` is "", every month or harness. */
function setOrDelete(params, key, value) {
  if (value === "") {
    params.delete(key);
  } else {
    params.set(key, value);
  }
}

/** Each of `named` that `known` does not hold, once, in words: "month 2026-01". */
function unknownWords(kind, named, known) {
  const unknown = new Set(named.filter((name) => !known.includes(name)));
  return [...unknown].map((name) => `${kind} ${name}`);
}
