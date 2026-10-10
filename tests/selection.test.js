import assert from "node:assert/strict";
import { test } from "node:test";

import { readSelection, scopesOf, selectionQuery, weeksByMonth, writeSelection } from "../site/js/shared/selection.js";

// Four weeks over two months, oldest first, as weeks.json holds them.
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-06-07", last_day: "2026-06-13", month: "2026-06", simulated: true },
  { week: "2026-06-14", last_day: "2026-06-20", month: "2026-06", simulated: false },
];

function read(query) {
  return readSelection(new URLSearchParams(query), WEEKS);
}

test("weeks= selects the named weeks, oldest first and without duplicates", () => {
  assert.deepEqual(read("weeks=2026-06-07,2026-05-24,2026-06-07"), {
    weeks: ["2026-05-24", "2026-06-07"],
    scope: "Agentic",
    unknownWeeks: [],
    unknownMonth: null,
  });
});

test("weeks=all selects every week", () => {
  assert.deepEqual(read("weeks=all").weeks, ["2026-05-24", "2026-05-31", "2026-06-07", "2026-06-14"]);
});

test("month= selects the weeks whose Sunday falls in that month", () => {
  assert.deepEqual(read("month=2026-05").weeks, ["2026-05-24", "2026-05-31"]);
});

test("weeks= takes precedence over month=", () => {
  assert.deepEqual(read("month=2026-05&weeks=2026-06-07").weeks, ["2026-06-07"]);
});

test("spaces around the named weeks are ignored", () => {
  assert.deepEqual(read("weeks= 2026-05-31 , 2026-06-14").weeks, ["2026-05-31", "2026-06-14"]);
});

test("an empty weeks= selects the latest week", () => {
  assert.deepEqual(read("weeks=").weeks, ["2026-06-14"]);
});

test("with no selection in the URL, the latest week is selected", () => {
  assert.deepEqual(read(""), { weeks: ["2026-06-14"], scope: "Agentic", unknownWeeks: [], unknownMonth: null });
});

test("an unknown week is ignored and reported", () => {
  const selection = read("weeks=2026-05-31,2025-01-05");
  assert.deepEqual(selection.weeks, ["2026-05-31"]);
  assert.deepEqual(selection.unknownWeeks, ["2025-01-05"]);
});

test("when every named week is unknown, the latest week is selected and the unknown ones reported", () => {
  const selection = read("weeks=2025-01-05,2025-01-12");
  assert.deepEqual(selection.weeks, ["2026-06-14"]);
  assert.deepEqual(selection.unknownWeeks, ["2025-01-05", "2025-01-12"]);
});

test("a month that holds no week selects the latest week and is reported", () => {
  const selection = read("month=2025-01");
  assert.deepEqual(selection.weeks, ["2026-06-14"]);
  assert.equal(selection.unknownMonth, "2025-01");
  assert.equal(read("month=2026-05").unknownMonth, null);
});

test("the scope is Agentic by default and when the URL names no such scope", () => {
  assert.equal(read("").scope, "Agentic");
  assert.equal(read("scope=Everything").scope, "Agentic");
});

test("the scope All and SWE-Bench are read from the URL", () => {
  assert.equal(read("month=2026-06&scope=All").scope, "All");
  assert.equal(read("scope=SWE-Bench").scope, "SWE-Bench");
});

function write(selection) {
  return writeSelection(new URLSearchParams("sort=requests&weeks=2026-05-24&scope=All"), selection, WEEKS);
}

test("every week selected is written as weeks=all", () => {
  const selection = { weeks: ["2026-05-24", "2026-05-31", "2026-06-07", "2026-06-14"], scope: "Agentic", unknownWeeks: [] };
  assert.equal(write(selection).toString(), "sort=requests&weeks=all");
});

test("exactly one whole month is written as month=", () => {
  const selection = { weeks: ["2026-06-07", "2026-06-14"], scope: "SWE-Bench", unknownWeeks: [] };
  assert.equal(write(selection).toString(), "sort=requests&month=2026-06&scope=SWE-Bench");
});

test("a month of one week is written as month=", () => {
  const weeks = [...WEEKS, { week: "2026-07-05", last_day: "2026-07-11", month: "2026-07", simulated: false }];
  const selection = { weeks: ["2026-07-05"], scope: "Agentic", unknownWeeks: [], unknownMonth: null };
  assert.equal(writeSelection(new URLSearchParams(), selection, weeks).toString(), "month=2026-07");
});

test("a selection with no week writes neither weeks nor month, so a reload opens on the latest week", () => {
  const selection = { weeks: [], scope: "All", unknownWeeks: [], unknownMonth: null };
  const written = write(selection);
  assert.equal(written.toString(), "sort=requests&scope=All");
  assert.deepEqual(readSelection(written, WEEKS).weeks, ["2026-06-14"]);
});

test("any other selection is written as a list of weeks", () => {
  const selection = { weeks: ["2026-05-31", "2026-06-07"], scope: "All", unknownWeeks: [] };
  const written = write(selection);
  assert.equal(written.get("weeks"), "2026-05-31,2026-06-07");
  assert.equal(written.get("month"), null);
  assert.equal(written.get("scope"), "All");
});

test("writing keeps foreign keys and leaves the given parameters unchanged", () => {
  const params = new URLSearchParams("sort=requests");
  const written = writeSelection(params, { weeks: ["2026-05-24"], scope: "Agentic", unknownWeeks: [] }, WEEKS);
  assert.equal(written.get("sort"), "requests");
  assert.equal(written.get("weeks"), "2026-05-24");
  assert.equal(params.toString(), "sort=requests");
});

test("a written selection reads back as itself", () => {
  const selection = { weeks: ["2026-05-24", "2026-06-14"], scope: "SWE-Bench", unknownWeeks: [], unknownMonth: null };
  assert.deepEqual(readSelection(write(selection), WEEKS), selection);
});

test("the query string keeps the commas of weeks= plain", () => {
  const params = new URLSearchParams("sort=requests");
  params.set("weeks", "2026-05-31,2026-06-07");
  assert.equal(selectionQuery(params), "?sort=requests&weeks=2026-05-31,2026-06-07");
  assert.equal(selectionQuery(new URLSearchParams("month=2026-05&scope=SWE-Bench")), "?month=2026-05&scope=SWE-Bench");
});

test("no keys give an empty query string", () => {
  assert.equal(selectionQuery(new URLSearchParams()), "");
});

test("each scope covers its scopes of data, and All covers both", () => {
  assert.deepEqual(scopesOf("Agentic"), ["Agentic"]);
  assert.deepEqual(scopesOf("SWE-Bench"), ["SWE-Bench"]);
  assert.deepEqual(scopesOf("All"), ["Agentic", "SWE-Bench"]);
});

test("an unknown scope covers the default's scopes", () => {
  assert.deepEqual(scopesOf("Everything"), ["Agentic"]);
});

test("the scopes returned are a copy", () => {
  scopesOf("All").push("Other");
  assert.deepEqual(scopesOf("All"), ["Agentic", "SWE-Bench"]);
});

test("weeks are grouped by month, oldest first", () => {
  assert.deepEqual(weeksByMonth(WEEKS), [
    { month: "2026-05", weeks: [WEEKS[0], WEEKS[1]] },
    { month: "2026-06", weeks: [WEEKS[2], WEEKS[3]] },
  ]);
});
