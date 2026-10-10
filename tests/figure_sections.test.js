import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { FIGURES } from "../site/js/figures/sessions.js";

// The site's query folder; a figure's query `figures/<name>` is the file `figures/<name>.sql` in it.
const QUERIES_FOLDER = new URL("../site/queries/", import.meta.url);

// The Sessions figures the page draws, in order.
const SESSIONS_FIGURE_NAMES = [
  "requests_per_session_cdf",
  "duration_cdf",
  "tokens_per_request_cdf",
  "token_split_by_week",
  "token_growth_by_messages",
  "context_share_by_role",
  "ttft_cdf_by_model",
];

test("the Sessions section lists its figures in order, and the list cannot be changed", () => {
  assert.deepEqual(FIGURES.map((figure) => figure.name), SESSIONS_FIGURE_NAMES);
  assert.ok(Object.isFrozen(FIGURES));
  for (const figure of FIGURES) {
    assert.ok(Object.isFrozen(figure), figure.name);
  }
});

test("every figure runs the query of its own name, and that query file exists", () => {
  for (const figure of FIGURES) {
    assert.equal(figure.query, `figures/${figure.name}`);
    assert.ok(existsSync(new URL(`${figure.query}.sql`, QUERIES_FOLDER)), `${figure.query}.sql`);
  }
});

test("every figure has a title, a one-sentence definition, a bin column and a draw function", () => {
  for (const figure of FIGURES) {
    assert.ok(figure.title.length > 0, figure.name);
    assert.ok(figure.definition.endsWith("."), figure.name);
    assert.equal(figure.definition.split(". ").length, 1, `${figure.name}: one sentence`);
    assert.equal(typeof figure.binColumn, "string", figure.name);
    assert.equal(typeof figure.draw, "function", figure.name);
  }
});
