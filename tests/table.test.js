import assert from "node:assert/strict";
import { test } from "node:test";

import { filterRows, pageRows, ROWS_PER_PAGE, searchRows, sortRows } from "../site/js/shared/table.js";

const SESSIONS = [
  { id: "a1", harness: "claude-code", requests: 12 },
  { id: "B2", harness: "codex", requests: 3 },
  { id: "c3", harness: "claude-code", requests: 40 },
  { id: "d4", harness: "Aider", requests: 3 },
];

function ids(rows) {
  return rows.map((row) => row.id);
}

function numbered(count) {
  return Array.from({ length: count }, (_, index) => ({ id: index + 1 }));
}

test("numbers sort numerically in both directions", () => {
  const rows = [{ id: "nine", value: 9 }, { id: "ten", value: 10 }, { id: "two", value: 2 }];
  assert.deepEqual(ids(sortRows(rows, "value", "ascending")), ["two", "nine", "ten"]);
  assert.deepEqual(ids(sortRows(rows, "value", "descending")), ["ten", "nine", "two"]);
});

test("strings sort by locale in both directions", () => {
  assert.deepEqual(ids(sortRows(SESSIONS, "harness", "ascending")), ["d4", "a1", "c3", "B2"]);
  assert.deepEqual(ids(sortRows(SESSIONS, "harness", "descending")), ["B2", "a1", "c3", "d4"]);
});

test("missing values sort last in both directions", () => {
  const rows = [{ id: "none", value: null }, { id: "five", value: 5 }, { id: "unset" }, { id: "one", value: 1 }];
  assert.deepEqual(ids(sortRows(rows, "value", "ascending")), ["one", "five", "none", "unset"]);
  assert.deepEqual(ids(sortRows(rows, "value", "descending")), ["five", "one", "none", "unset"]);
});

test("rows with equal keys keep their input order", () => {
  assert.deepEqual(ids(sortRows(SESSIONS, "requests", "ascending")), ["B2", "d4", "a1", "c3"]);
  assert.deepEqual(ids(sortRows(SESSIONS, "requests", "descending")), ["c3", "a1", "B2", "d4"]);
});

test("sorting returns a new array and leaves the input alone", () => {
  const sorted = sortRows(SESSIONS, "requests", "ascending");
  assert.notEqual(sorted, SESSIONS);
  assert.deepEqual(ids(SESSIONS), ["a1", "B2", "c3", "d4"]);
});

test("search matches a substring and ignores case", () => {
  assert.deepEqual(ids(searchRows(SESSIONS, "id", "b")), ["B2"]);
  assert.deepEqual(ids(searchRows(SESSIONS, "harness", "CLAUDE")), ["a1", "c3"]);
  assert.deepEqual(ids(searchRows(SESSIONS, "id", "zz")), []);
});

test("an empty search returns every row", () => {
  assert.deepEqual(ids(searchRows(SESSIONS, "id", "")), ["a1", "B2", "c3", "d4"]);
});

test("an equals filter keeps rows with that exact value", () => {
  const conditions = [{ key: "harness", equals: "claude-code" }];
  assert.deepEqual(ids(filterRows(SESSIONS, conditions)), ["a1", "c3"]);
});

test("an atLeast filter keeps rows at or above the number", () => {
  assert.deepEqual(ids(filterRows(SESSIONS, [{ key: "requests", atLeast: 12 }])), ["a1", "c3"]);
});

test("combined filters keep rows matching every condition", () => {
  const conditions = [
    { key: "harness", equals: "claude-code" },
    { key: "requests", atLeast: 13 },
  ];
  assert.deepEqual(ids(filterRows(SESSIONS, conditions)), ["c3"]);
});

test("an empty filter list returns every row", () => {
  assert.deepEqual(ids(filterRows(SESSIONS, [])), ["a1", "B2", "c3", "d4"]);
});

test("a condition with neither equals nor atLeast is an error", () => {
  assert.throws(() => filterRows(SESSIONS, [{ key: "requests", below: 5 }]), /needs "equals" or "atLeast"/);
});

test("the first page holds the first rows", () => {
  const page = pageRows(numbered(120), 1, 50);
  assert.equal(page.pageNumber, 1);
  assert.equal(page.pageCount, 3);
  assert.equal(page.rows.length, 50);
  assert.equal(page.rows[0].id, 1);
  assert.equal(page.rows[49].id, 50);
});

test("the last page holds the remaining rows", () => {
  const page = pageRows(numbered(120), 3, 50);
  assert.equal(page.pageNumber, 3);
  assert.equal(page.rows.length, 20);
  assert.equal(page.rows[0].id, 101);
  assert.equal(page.rows[19].id, 120);
});

test("a page number below one is clamped to the first page", () => {
  const page = pageRows(numbered(120), 0, 50);
  assert.equal(page.pageNumber, 1);
  assert.equal(page.rows[0].id, 1);
});

test("a page number past the end is clamped to the last page", () => {
  const page = pageRows(numbered(120), 9, 50);
  assert.equal(page.pageNumber, 3);
  assert.equal(page.rows.length, 20);
  assert.equal(page.rows[0].id, 101);
});

test("an exact multiple of the page size has no empty last page", () => {
  assert.equal(pageRows(numbered(100), 1, 50).pageCount, 2);
});

test("an empty array has one empty page", () => {
  assert.deepEqual(pageRows([], 4, 50), { rows: [], pageCount: 1, pageNumber: 1 });
});

test("a page holds fifty rows", () => {
  assert.equal(ROWS_PER_PAGE, 50);
});
