import assert from "node:assert/strict";
import { test } from "node:test";

import { plainRow, withDataUrl } from "../site/js/shared/database.js";

const VIEW_STATEMENT = "FROM read_parquet('{data_url}/requests.parquet');";

test("the data URL replaces the placeholder", () => {
  assert.equal(
    withDataUrl(VIEW_STATEMENT, "https://example.org/site/data"),
    "FROM read_parquet('https://example.org/site/data/requests.parquet');",
  );
});

test("a data URL ending in a slash does not double the slash", () => {
  assert.equal(
    withDataUrl(VIEW_STATEMENT, "http://localhost:8000/data/"),
    "FROM read_parquet('http://localhost:8000/data/requests.parquet');",
  );
});

test("a statement without the placeholder is unchanged", () => {
  const statement = "FROM read_parquet('https://example.org/requests.parquet');";
  assert.equal(withDataUrl(statement, "http://localhost:8000/data/"), statement);
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
