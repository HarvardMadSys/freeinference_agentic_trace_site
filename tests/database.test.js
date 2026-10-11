import assert from "node:assert/strict";
import { test } from "node:test";

import { fileUrl, plainRow, weekFileNames, withFileNames } from "../site/js/shared/database.js";

// A view statement as the setup files write it, and two weeks as weeks.json lists them, the second not simulated.
const VIEW_STATEMENT = "FROM read_parquet([{files}], hive_partitioning = true);";
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: false },
];

test("every week has a file of requests, tool calls and sessions, named by its kind and Sunday", () => {
  assert.deepEqual(weekFileNames("requests", WEEKS), [
    "requests/week=2026-05-24/rows.parquet",
    "requests/week=2026-05-31/rows.parquet",
  ]);
  assert.equal(weekFileNames("sessions", WEEKS).length, 2);
});

test("only a simulated week has a simulation file", () => {
  assert.deepEqual(weekFileNames("simulation", WEEKS), ["simulation/week=2026-05-24/rows.parquet"]);
  assert.deepEqual(weekFileNames("simulation", [WEEKS[1]]), []);
});

test("a file's URL is inside the data folder, with or without the folder's trailing slash", () => {
  const name = "requests/week=2026-05-24/rows.parquet";
  assert.equal(fileUrl("http://localhost:8000/data/", name), "http://localhost:8000/data/requests/week=2026-05-24/rows.parquet");
  assert.equal(fileUrl("https://example.org/site/data", name), "https://example.org/site/data/requests/week=2026-05-24/rows.parquet");
});

test("the file names replace the placeholder, each quoted, separated by commas", () => {
  const names = ["requests/week=2026-05-24/rows.parquet", "requests/week=2026-05-31/rows.parquet"];
  assert.equal(
    withFileNames(VIEW_STATEMENT, names),
    "FROM read_parquet(['requests/week=2026-05-24/rows.parquet', 'requests/week=2026-05-31/rows.parquet'], hive_partitioning = true);",
  );
});

test("a quote in a file name is doubled and a dollar sign is kept as it is", () => {
  assert.equal(withFileNames("[{files}]", ["a'b$&c"]), "['a''b$&c']");
});

test("bigint values become numbers", () => {
  assert.deepEqual(plainRow({ requests: 1186582n, sessions: 0n }), { requests: 1186582, sessions: 0 });
  assert.equal(typeof plainRow({ requests: 12n }).requests, "number");
});

test("values of other types are left as they are", () => {
  const percentiles = [10.5, 20];
  const row = plainRow({ week: "2026-05-31", hit_ratio: 0.63, ttft_ms: null, is_top_level: true, percentiles });
  assert.deepEqual(row, { week: "2026-05-31", hit_ratio: 0.63, ttft_ms: null, is_top_level: true, percentiles });
  assert.equal(row.percentiles, percentiles);
});

test("the row given is not changed", () => {
  const row = { requests: 7n };
  plainRow(row);
  assert.equal(row.requests, 7n);
});
