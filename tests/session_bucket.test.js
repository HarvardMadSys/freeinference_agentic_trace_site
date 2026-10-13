import assert from "node:assert/strict";
import { test } from "node:test";
import { gzipSync } from "node:zlib";

import {
  bodyText, bucketUrl, fetchCategoryOrder, fetchSession, isGzipped, prefixOf, rowObjects, sessionRows,
} from "../site/js/session/bucket.js";

const DATA_URL = "http://localhost:8000/data/";
const WEEK = "2026-07-26";

// A top-level session `aa11` with a subagent `bb22` (another prefix) and a subagent `aa33` (the same prefix), as the
// data step writes its entry: each part's columns, and each row's values in their order.
const ROOT_ENTRY = {
  tree: {
    columns: ["session_id", "parent_session_id", "depth", "requests"],
    rows: [["aa11", null, 0, 2], ["bb22", "aa11", 1, 1], ["aa33", "aa11", 1, 1]],
  },
  requests: {
    columns: ["session_id", "step", "start_ms", "ttft_ms"],
    rows: [["aa11", 0, 1780186600000, 1000], ["aa11", 1, 1780186620000, null], ["aa33", 0, 1780186630000, 900],
      ["bb22", 0, 1780186640000, 800]],
  },
  tool_calls: {
    columns: ["session_id", "step", "call_index", "name", "programs"],
    rows: [["aa11", 0, 0, "bash", ["cd", "pytest"]], ["aa11", 0, 1, "read", null]],
  },
};
// Another top-level session in the bucket `bb`, which holds no subagent.
const OTHER_ENTRY = { tree: { columns: ["session_id"], rows: [["bb99"]] }, requests: { columns: [], rows: [] },
  tool_calls: { columns: [], rows: [] } };
const INDEX = { aa11: "aa11", aa33: "aa11", bb22: "aa11", bb99: "bb99" };

/** The bytes of `value` as JSON, gzipped as the data step writes a bucket, or plain as a decompressing host sends it. */
function bytesOf(value, gzipped) {
  const text = JSON.stringify(value);
  return gzipped ? gzipSync(text, { level: 9 }) : new TextEncoder().encode(text);
}

/** The week's bucket folder: the two buckets and the index, by their URLs. */
function weekFiles(gzipped) {
  return {
    [`${DATA_URL}session_buckets/${WEEK}/aa.json.gz`]: bytesOf({ aa11: ROOT_ENTRY }, gzipped),
    [`${DATA_URL}session_buckets/${WEEK}/bb.json.gz`]: bytesOf({ bb99: OTHER_ENTRY }, gzipped),
    [`${DATA_URL}session_buckets/${WEEK}/index.json.gz`]: bytesOf(INDEX, gzipped),
  };
}

/** A stand-in for `fetch` that answers each URL of `files` with its bytes and 404s any other, recording each URL. */
function fakeFetch(files, asked) {
  async function fetchFile(url) {
    asked.push(url);
    const bytes = files[url];
    if (bytes === undefined) {
      return { ok: false, status: 404, statusText: "Not Found" };
    }
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
    return { ok: true, status: 200, arrayBuffer: async () => buffer };
  }
  return fetchFile;
}

/** The URLs a test's fetches asked for, relative to the week's bucket folder. */
function relative(asked) {
  return asked.map((url) => url.replace(`${DATA_URL}session_buckets/${WEEK}/`, ""));
}

test("a part's columns and rows become one object per row", () => {
  assert.deepEqual(rowObjects(ROOT_ENTRY.tool_calls), [
    { session_id: "aa11", step: 0, call_index: 0, name: "bash", programs: ["cd", "pytest"] },
    { session_id: "aa11", step: 0, call_index: 1, name: "read", programs: null },
  ]);
  assert.deepEqual(rowObjects({ columns: ["a"], rows: [] }), []);
});

test("an entry becomes the tree, requests and tool calls the views take", () => {
  const rows = sessionRows(ROOT_ENTRY);
  assert.deepEqual(Object.keys(rows), ["tree", "requests", "toolCalls"]);
  assert.deepEqual(rows.tree.map((row) => row.session_id), ["aa11", "bb22", "aa33"]);
  assert.equal(rows.requests[1].ttft_ms, null);
  assert.equal(rows.toolCalls.length, 2);
});

test("a bucket is named by the first two characters of the id", () => {
  assert.equal(prefixOf("740dd162030203354c9e55d40fb3a2d5"), "74");
  assert.equal(bucketUrl(DATA_URL, WEEK, "740dd1"), `${DATA_URL}session_buckets/${WEEK}/74.json.gz`);
});

test("gzipped bytes are recognised by their first two bytes and decompressed; plain bytes are read as they are", async () => {
  const gzipped = bytesOf({ a: 1 }, true);
  const plain = bytesOf({ a: 1 }, false);
  assert.deepEqual([isGzipped(gzipped), isGzipped(plain), isGzipped(new Uint8Array([0x1f]))], [true, false, false]);
  assert.equal(await bodyText(gzipped), '{"a":1}');
  assert.equal(await bodyText(plain), '{"a":1}');
});

for (const gzipped of [true, false]) {
  const body = gzipped ? "a gzipped body" : "a body the host decompressed";

  test(`a top-level id opens its session from one bucket fetch, from ${body}`, async (context) => {
    const asked = [];
    context.mock.method(globalThis, "fetch", fakeFetch(weekFiles(gzipped), asked));
    const session = await fetchSession(DATA_URL, WEEK, "aa11");
    assert.deepEqual(session, sessionRows(ROOT_ENTRY));
    assert.deepEqual(relative(asked), ["aa.json.gz"]);
  });

  test(`a subagent's id of another prefix opens its top-level session in three fetches, from ${body}`,
    async (context) => {
      const asked = [];
      context.mock.method(globalThis, "fetch", fakeFetch(weekFiles(gzipped), asked));
      const session = await fetchSession(DATA_URL, WEEK, "bb22");
      assert.deepEqual(session, sessionRows(ROOT_ENTRY));
      assert.deepEqual(relative(asked), ["bb.json.gz", "index.json.gz", "aa.json.gz"]);
    });
}

test("a subagent's id of its top-level session's prefix opens it in two fetches", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch(weekFiles(true), asked));
  assert.deepEqual(await fetchSession(DATA_URL, WEEK, "aa33"), sessionRows(ROOT_ENTRY));
  assert.deepEqual(relative(asked), ["aa.json.gz", "index.json.gz"]);
});

test("an id the week does not hold, whether or not its prefix has a bucket, is null", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch(weekFiles(true), asked));
  assert.equal(await fetchSession(DATA_URL, WEEK, "aa77"), null);
  assert.equal(await fetchSession(DATA_URL, WEEK, "zz77"), null);
  assert.deepEqual(relative(asked), ["aa.json.gz", "index.json.gz", "zz.json.gz", "index.json.gz"]);
});

test("a week the data does not hold is null", async (context) => {
  context.mock.method(globalThis, "fetch", fakeFetch(weekFiles(true), []));
  assert.equal(await fetchSession(DATA_URL, "2000-01-02", "aa11"), null);
});

test("a fetch that fails other than for a missing file is an error naming the file", async (context) => {
  async function failing(url) {
    return { ok: false, status: 500, statusText: "Internal Server Error", url };
  }
  context.mock.method(globalThis, "fetch", failing);
  await assert.rejects(fetchSession(DATA_URL, WEEK, "aa11"), /aa\.json\.gz: 500 Internal Server Error/);
});

test("an index that names a top-level session its bucket does not hold is an error", async (context) => {
  const files = weekFiles(true);
  files[`${DATA_URL}session_buckets/${WEEK}/index.json.gz`] = bytesOf({ cc44: "dd55" }, true);
  context.mock.method(globalThis, "fetch", fakeFetch(files, []));
  await assert.rejects(fetchSession(DATA_URL, WEEK, "cc44"), /names the session dd55/);
});

test("the category order is the shipped answer's categories in its order", async (context) => {
  const answer = [{ category: "Read", calls: 10 }, { category: "Edit", calls: 4 }];
  const files = { [`${DATA_URL}all_weeks/setup/category_order.json`]: bytesOf(answer, false) };
  context.mock.method(globalThis, "fetch", fakeFetch(files, []));
  assert.deepEqual(await fetchCategoryOrder(DATA_URL), ["Read", "Edit"]);
});
