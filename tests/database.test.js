import assert from "node:assert/strict";
import { test } from "node:test";

import { runQuery } from "../site/js/shared/database.js";

// The trace totals' answer as the data step writes it: whole numbers as JSON numbers, a ratio as a float.
const ANSWER_TEXT = '[{"sessions":10967,"input_tokens":207377727534,"hit_ratio":0.63,"week":"2026-05-31"}]';

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
    return { ok: true, json: async () => JSON.parse(text) };
  }
  return fetchFile;
}

test("a query is answered from its file under data/all_weeks/, and nothing else is fetched", async (context) => {
  const asked = [];
  context.mock.method(globalThis, "fetch", fakeFetch({ "data/all_weeks/explore/trace_totals.json": ANSWER_TEXT }, asked));
  assert.deepEqual(await runQuery("explore/trace_totals"), JSON.parse(ANSWER_TEXT));
  assert.deepEqual(asked, ["data/all_weeks/explore/trace_totals.json"]);
});

test("a missing answer file is an error naming the file", async (context) => {
  context.mock.method(globalThis, "fetch", fakeFetch({}, []));
  await assert.rejects(runQuery("figures/duration_cdf"), /data\/all_weeks\/figures\/duration_cdf\.json: 404/);
});
