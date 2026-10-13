/**
 * The sessions table's filter by month and harness: the URL keys `months` and `harnesses` that hold it, the rows it
 * keeps, and the choices of the month and harness drop-downs that change it.
 *
 * A filter is `{ month, harness, unknown }`: the chosen month ("YYYY-MM"), or "" for every month; the chosen harness,
 * or "" for every harness, the benchmark's included; and what the URL named that the data do not hold, each in words
 * such as "month 2026-01". A month keeps the sessions whose start, in UTC, falls in that calendar month. `weeks` below
 * is the array `weeks.json` holds, oldest first: `{ week, last_day, month, simulated }`; `harnesses` is the array
 * `harnesses.json` holds, most sessions first: `{ harness, sessions, benchmark }`.
 */

import { monthName } from "../shared/format.js";
import { harnessText, setOrDelete } from "./sessions_table_state.js";

// The URL keys the filter is written in, one value each.
const MONTHS_KEY = "months";
const HARNESSES_KEY = "harnesses";

// The length of a month's name in a date, "2026-07" of "2026-07-05": the month a date or a timestamp falls in.
const MONTH_LENGTH = "YYYY-MM".length;

// The text of the month drop-down's first choice, which filters nothing.
const EVERY_MONTH_TEXT = "All months";

// The text of the harness drop-down's first choice, which filters nothing.
const EVERY_HARNESS_TEXT = "All harnesses";

/**
 * The filter the URL's `months` and `harnesses` name. A key naming several months or harnesses keeps the first the
 * data hold; with none known, every month or every harness.
 */
export function readTableFilter(params, weeks, harnesses) {
  const everyMonth = monthsOf(weeks);
  const namedMonths = namesIn(params.get(MONTHS_KEY) ?? "");
  const everyHarness = harnesses.map((entry) => entry.harness);
  const namedHarnesses = namesIn(params.get(HARNESSES_KEY) ?? "");
  const unknown = [
    ...unknownWords("month", namedMonths, everyMonth),
    ...unknownWords("harness", namedHarnesses, everyHarness),
  ];
  return { month: firstKnown(namedMonths, everyMonth), harness: firstKnown(namedHarnesses, everyHarness), unknown };
}

/**
 * A copy of `params` with `filter` written and every other key untouched; a key already there keeps its place. Every
 * month writes no `months`, every harness no `harnesses`.
 */
export function writeTableFilter(params, filter) {
  const written = new URLSearchParams(params);
  setOrDelete(written, MONTHS_KEY, filter.month, "");
  setOrDelete(written, HARNESSES_KEY, filter.harness, "");
  return written;
}

/**
 * The months of `weeks`, oldest first ("2026-05"): every calendar month from the first week's Sunday to the last week's
 * Saturday, once; none for no week.
 */
export function monthsOf(weeks) {
  if (weeks.length === 0) {
    return [];
  }
  const last = weeks.at(-1).last_day.slice(0, MONTH_LENGTH);
  const months = [weeks[0].week.slice(0, MONTH_LENGTH)];
  while (months.at(-1) < last) {
    months.push(nextMonth(months.at(-1)));
  }
  return months;
}

/** The month a session row started in, in UTC, from its `first_start_ms`: "2026-06". */
export function startMonth(row) {
  return new Date(row.first_start_ms).toISOString().slice(0, MONTH_LENGTH);
}

/** The rows that started in the filter's month, in UTC, and whose harness is its harness; "" keeps every one. */
export function rowsInFilter(rows, filter) {
  const kept = [];
  for (const row of rows) {
    const isInMonth = filter.month === "" || startMonth(row) === filter.month;
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

/** The month after `month`, both "YYYY-MM": "2026-12" → "2027-01". */
function nextMonth(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = monthNumber === 12 ? { year: year + 1, month: 1 } : { year, month: monthNumber + 1 };
  return `${next.year}-${String(next.month).padStart(2, "0")}`;
}

/** The first of `named` that `known` holds, or "" when it holds none. */
function firstKnown(named, known) {
  return named.find((name) => known.includes(name)) ?? "";
}

/** The comma-separated names of a URL value, each trimmed, empty ones dropped. */
function namesIn(value) {
  return value.split(",").map((name) => name.trim()).filter((name) => name !== "");
}

/** Each of `named` that `known` does not hold, once, in words: "month 2026-01". */
function unknownWords(kind, named, known) {
  const unknown = new Set(named.filter((name) => !known.includes(name)));
  return [...unknown].map((name) => `${kind} ${name}`);
}
