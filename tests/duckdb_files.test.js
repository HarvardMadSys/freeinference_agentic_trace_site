import assert from "node:assert/strict";
import { test } from "node:test";

import {
  fileUrl, streamingOrder, streamWeekFiles, swapFileToMemory, weekFileNames, withFileNames,
} from "../site/js/engine/duckdb_files.js";

// A view statement as the setup files write it, and two weeks as weeks.json lists them, the second not simulated.
const VIEW_STATEMENT = "FROM read_parquet([{files}], hive_partitioning = true);";
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: false },
];
// The kinds of row in the order the views are made.
const KINDS = ["requests", "tool_calls", "sessions", "simulation"];
const DATA_URL = "http://localhost:8000/data/";

/** A stand-in for the page's document: visible until `hide()`, which tells the listeners as the browser does. */
function fakeDocument() {
  const listeners = new Set();
  return {
    visibilityState: "visible",
    addEventListener: (type, listener) => listeners.add(listener),
    removeEventListener: (type, listener) => listeners.delete(listener),
    hide() {
      this.visibilityState = "hidden";
      for (const listener of listeners) {
        listener();
      }
    },
    listenerCount: () => listeners.size,
  };
}

/** Make `page` the global document for the test of `context`; node has none of its own. */
function useDocument(context, page) {
  globalThis.document = page;
  context.after(() => delete globalThis.document);
}

/** A stand-in for `fetch` that answers every URL with three bytes, recording each URL and its options in `asked`. */
function bytesFetch(asked) {
  async function fetchBytes(url, options) {
    asked.push({ url, options });
    return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
  }
  return fetchBytes;
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

test("the stream takes the newest week first, each week's files in the order of the kinds", () => {
  assert.deepEqual(streamingOrder(WEEKS, KINDS), [
    {
      week: "2026-05-31",
      names: ["requests/week=2026-05-31/rows.parquet", "tool_calls/week=2026-05-31/rows.parquet",
        "sessions/week=2026-05-31/rows.parquet"],
    },
    {
      week: "2026-05-24",
      names: ["requests/week=2026-05-24/rows.parquet", "tool_calls/week=2026-05-24/rows.parquet",
        "sessions/week=2026-05-24/rows.parquet", "simulation/week=2026-05-24/rows.parquet"],
    },
  ]);
  assert.deepEqual(WEEKS.map((entry) => entry.week), ["2026-05-24", "2026-05-31"]);
});

test("a swap drops the file's URL, then registers its bytes under the same name", async () => {
  const calls = [];
  const engine = {
    dropFile: async (name) => calls.push(["drop", name]),
    registerFileBuffer: async (name, bytes) => calls.push(["buffer", name, bytes.length]),
  };
  await swapFileToMemory(engine, "requests/week=2026-05-24/rows.parquet", new Uint8Array(5));
  assert.deepEqual(calls, [["drop", "requests/week=2026-05-24/rows.parquet"],
    ["buffer", "requests/week=2026-05-24/rows.parquet", 5]]);
});

test("every file is fetched once at low priority and swapped in, and progress follows each week", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", bytesFetch(asked));
  const page = fakeDocument();
  useDocument(context, page);
  const swapped = [];
  const progress = [];
  const order = streamingOrder(WEEKS, KINDS);
  await streamWeekFiles(DATA_URL, order, async (name, bytes) => swapped.push([name, bytes.length]), (update) => {
    progress.push({ swapped: swapped.length, streamedWeeks: update.streamedWeeks });
  });
  const names = order.flatMap((entry) => entry.names);
  assert.deepEqual(asked.map((entry) => entry.url), names.map((name) => fileUrl(DATA_URL, name)));
  assert.ok(asked.every((entry) => entry.options.priority === "low"));
  assert.deepEqual(swapped, names.map((name) => [name, 3]));
  assert.deepEqual(progress, [
    { swapped: 3, streamedWeeks: ["2026-05-31"] },
    { swapped: 7, streamedWeeks: ["2026-05-31", "2026-05-24"] },
  ]);
  assert.equal(page.listenerCount(), 0);
});

test("hiding the page stops the stream for good, without an error", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", bytesFetch(asked));
  const page = fakeDocument();
  useDocument(context, page);
  const progress = [];
  async function swapThenHide() {
    page.hide();
  }
  await streamWeekFiles(DATA_URL, streamingOrder(WEEKS, KINDS), swapThenHide, (update) => progress.push(update));
  assert.equal(asked.length, 1);
  assert.deepEqual(progress, []);
  assert.equal(page.listenerCount(), 0);
});

test("a page already hidden streams nothing", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", bytesFetch(asked));
  const page = fakeDocument();
  page.visibilityState = "hidden";
  useDocument(context, page);
  await streamWeekFiles(DATA_URL, streamingOrder(WEEKS, KINDS), async () => undefined, () => undefined);
  assert.equal(asked.length, 0);
});

test("a failed fetch stops the stream with an error naming the file", async (context) => {
  async function notFound() {
    return { ok: false, status: 404, statusText: "Not Found" };
  }
  context.mock.method(globalThis, "fetch", notFound);
  useDocument(context, fakeDocument());
  const swapped = [];
  await assert.rejects(
    streamWeekFiles(DATA_URL, streamingOrder(WEEKS, KINDS), async (name) => swapped.push(name), () => undefined),
    /requests\/week=2026-05-31\/rows\.parquet: 404/,
  );
  assert.deepEqual(swapped, []);
});
