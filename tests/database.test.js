import assert from "node:assert/strict";
import { test } from "node:test";

import { answerFileFor, openDatabase, plainRow, STREAM_ROWS_AFTER_DRAW } from "../site/js/shared/database.js";

// Two weeks as weeks.json lists them, the second not simulated.
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
    assert.equal(answerFileFor("setup/provider_order", isDefault), "data/all_weeks/setup/provider_order.json");
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
  await assert.rejects(database.runQuery("figures/duration_cdf"),
    /data\/all_weeks\/figures\/duration_cdf\.json: 404/);
});

test("another selection, and a query before any selection, start DuckDB and fetch no answer", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch({ "queries/explore/headline_numbers.sql": "SELECT 1;" }, asked));
  const narrowed = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  await assert.rejects(narrowed.setSelection({ weeks: ["2026-05-24"], harnesses: ["pi"] }), LOADING_LIBRARIES);
  const unselected = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  await assert.rejects(unselected.runQuery("explore/headline_numbers"), LOADING_LIBRARIES);
  assert.deepEqual(asked.filter((file) => file.startsWith("data/all_weeks/")), []);
});

test("streaming the rows is switched on or off by one boolean", () => {
  assert.equal(typeof STREAM_ROWS_AFTER_DRAW, "boolean");
});

// The next two tests each run with the constant one way only: off, `streamRows` returns before DuckDB would start.
const STREAMING_OFF = { skip: STREAM_ROWS_AFTER_DRAW };
const STREAMING_ON = { skip: !STREAM_ROWS_AFTER_DRAW };

test("with streaming switched off, streaming the rows does nothing", STREAMING_OFF, async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch({}, asked));
  const warn = context.mock.method(console, "warn", () => undefined);
  const progress = [];
  await openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES).streamRows((update) => progress.push(update));
  assert.deepEqual([asked, progress, warn.mock.callCount()], [[], [], 0]);
});

test("a stream that cannot start DuckDB warns once and does not reject", STREAMING_ON, async (context) => {
  context.mock.method(globalThis, "fetch", fakeFetch({}, []));
  const warn = context.mock.method(console, "warn", () => undefined);
  const database = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  const progress = [];
  await database.streamRows((update) => progress.push(update));
  assert.equal(warn.mock.callCount(), 1);
  assert.match(warn.mock.calls[0].arguments[0], /^Streaming the weeks' rows stopped: /);
  assert.deepEqual(progress, []);
});

test("loading the rows of a week the database does not have fetches nothing and starts no DuckDB", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch({}, asked));
  const database = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
  // node cannot load the CDN's DuckDB module, so starting DuckDB here would reject.
  await database.loadWeekRows("2026-06-07");
  assert.deepEqual(asked, []);
});

test("loading the rows of one of its weeks fetches its files while DuckDB starts, and DuckDB's failure is thrown",
  async (context) => {
    const asked = [];
    context.mock.method(globalThis, "fetch", fakeFetch({}, asked));
    // A visible page, as node has no document; and the files' 404s, each warned about.
    globalThis.document = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
    context.after(() => delete globalThis.document);
    const warn = context.mock.method(console, "warn", () => undefined);
    const database = openDatabase("http://localhost:8000/data/", WEEKS, HARNESSES);
    await assert.rejects(database.loadWeekRows("2026-05-31"), LOADING_LIBRARIES);
    assert.deepEqual(asked.filter((file) => file.includes("week=")), [
      "http://localhost:8000/data/requests/week=2026-05-31/rows.parquet",
      "http://localhost:8000/data/tool_calls/week=2026-05-31/rows.parquet",
      "http://localhost:8000/data/sessions/week=2026-05-31/rows.parquet",
    ]);
    assert.equal(warn.mock.callCount(), 3);
  });
