import assert from "node:assert/strict";
import { test } from "node:test";

import {
  answerFileFor, fileUrl, openDatabase, plainRow, weekFileNames, withFileNames,
} from "../site/js/shared/database.js";

// A view statement as the setup files write it, and two weeks as weeks.json lists them, the second not simulated.
const VIEW_STATEMENT = "FROM read_parquet([{files}], hive_partitioning = true);";
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: false },
];
// Two harnesses as harnesses.json lists them: the default selection is every week and `pi`.
const HARNESSES = [
  { harness: "pi", sessions: 10, benchmark: false },
  { harness: "swe-bench", sessions: 4, benchmark: true },
];
const DEFAULT_SELECTION = { weeks: ["2026-05-24", "2026-05-31"], harnesses: ["pi"] };
// The headline answer as the data step writes it: whole numbers as JSON numbers, a ratio as a float.
const ANSWER_TEXT = '[{"sessions":10967,"input_tokens":207377727534,"hit_ratio":0.63,"week":"2026-05-31"}]';

// The error node gives on loading the libraries module, whose CDN URLs it cannot import: DuckDB was being started.
const LOADING_LIBRARIES = { code: "ERR_UNSUPPORTED_ESM_URL_SCHEME" };

/**
 * A stand-in for the page's `fetch` that answers each file of `files` (a map from path to text) and 404s any other,
 * recording every path asked for in `asked`.
 */
function fakeFetch(files, asked) {
  async function fetchFile(file) {
    asked.push(file);
    const text = files[file];
    if (text === undefined) {
      return { ok: false, status: 404, statusText: "Not Found" };
    }
    return { ok: true, json: async () => JSON.parse(text), text: async () => text };
  }
  return fetchFile;
}

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

test("an Explore or figure query is answered from its file only while the selection is the default", () => {
  assert.equal(answerFileFor("explore/headline_numbers", true), "data/all_weeks/explore/headline_numbers.json");
  assert.equal(answerFileFor("figures/duration_cdf", true), "data/all_weeks/figures/duration_cdf.json");
  assert.equal(answerFileFor("explore/headline_numbers", false), null);
  assert.equal(answerFileFor("figures/duration_cdf", false), null);
});

test("a colour order is answered from its file whatever the selection", () => {
  for (const isDefault of [true, false]) {
    assert.equal(answerFileFor("setup/model_order", isDefault), "data/all_weeks/setup/model_order.json");
    assert.equal(answerFileFor("setup/category_order", isDefault), "data/all_weeks/setup/category_order.json");
    assert.equal(answerFileFor("setup/harness_order", isDefault), "data/all_weeks/setup/harness_order.json");
  }
});

test("a session query and any other setup statement are never answered from a file", () => {
  for (const isDefault of [true, false]) {
    for (const name of ["session/session_root", "session/session_requests", "session/session_tree",
      "session/session_tool_calls", "setup/create_view_requests", "setup/insert_selected_week"]) {
      assert.equal(answerFileFor(name, isDefault), null, name);
    }
  }
});

test("a live row with bigints and the same row read from its answer file are the same", () => {
  const live = { sessions: 10967n, input_tokens: 207377727534n, hit_ratio: 0.63, week: "2026-05-31" };
  assert.deepEqual(plainRow(live), JSON.parse(ANSWER_TEXT)[0]);
});

test("the default selection's query is answered from its file, through plainRow, without DuckDB", async (context) => {
  const asked = [];
  const files = { "data/all_weeks/explore/headline_numbers.json": ANSWER_TEXT };
  context.mock.method(globalThis, "fetch", fakeFetch(files, asked));
  const database = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  // node cannot load the CDN's DuckDB module, so any attempt to start DuckDB here would reject.
  await database.setSelection(DEFAULT_SELECTION);
  assert.deepEqual(await database.runQuery("explore/headline_numbers"), JSON.parse(ANSWER_TEXT));
  assert.deepEqual(asked, ["data/all_weeks/explore/headline_numbers.json"]);
});

test("a missing answer file is an error naming the file", async (context) => {
  context.mock.method(globalThis, "fetch", fakeFetch({}, []));
  const database = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  await database.setSelection(DEFAULT_SELECTION);
  await assert.rejects(database.runQuery("figures/dead_over_active_by_policy"),
    /data\/all_weeks\/figures\/dead_over_active_by_policy\.json: 404/);
});

test("another selection, and a query before any selection, start DuckDB and fetch no answer", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch({}, asked));
  const narrowed = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  await assert.rejects(narrowed.setSelection({ weeks: ["2026-05-24"], harnesses: ["pi"] }), LOADING_LIBRARIES);
  const unselected = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  await assert.rejects(unselected.runQuery("explore/headline_numbers"), LOADING_LIBRARIES);
  assert.deepEqual(asked.filter((file) => file.startsWith("data/all_weeks/")), []);
});
