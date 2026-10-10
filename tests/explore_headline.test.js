import assert from "node:assert/strict";
import { test } from "node:test";

import { cachedShare, headlineTiles, modelShares } from "../site/js/explore/headline.js";

const HEADLINE_ROW = {
  sessions: 12002,
  accounts: 267,
  requests: 1186582,
  input_tokens: 209199292539,
  output_tokens: 552524061,
  tool_calls: 1213347,
  subagents: 2034,
  reported_input_tokens: 200,
  cached_tokens: 150,
};

test("the tiles show every headline number in its format, the cached share last", () => {
  const tiles = headlineTiles(HEADLINE_ROW);
  assert.deepEqual(tiles.map((tile) => [tile.label, tile.value]), [
    ["Sessions", "12,002"],
    ["Accounts", "267"],
    ["Requests", "1,186,582"],
    ["Input tokens", "209.2B"],
    ["Output tokens", "552.5M"],
    ["Tool calls", "1,213,347"],
    ["Subagents", "2,034"],
    ["Cached share", "75.0%"],
  ]);
  for (const tile of tiles) {
    assert.ok(tile.definition.length > 0, `${tile.label} has a definition`);
  }
});

test("the cached share is cached over reported input, and missing when no input was reported", () => {
  assert.equal(cachedShare(150, 200), 0.75);
  assert.equal(cachedShare(0, 0), null);
  assert.equal(headlineTiles({ ...HEADLINE_ROW, reported_input_tokens: 0, cached_tokens: 0 }).at(-1).value, "—");
});

test("each model's share is its requests over every model's, in the rows' order", () => {
  const rows = [
    { model: "deepseek", requests: 3 },
    { model: "glm", requests: 1 },
  ];
  assert.deepEqual(modelShares(rows), [
    { model: "deepseek", requests: 3, share: 0.75 },
    { model: "glm", requests: 1, share: 0.25 },
  ]);
});
