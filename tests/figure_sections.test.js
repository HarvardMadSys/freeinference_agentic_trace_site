import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

// The site's query folder; a figure's query `figures/<name>` is the file `figures/<name>.sql` in it.
const QUERIES_FOLDER = new URL("../site/queries/", import.meta.url);

// Each section module of the Paper figures page, with the figures it draws, in order.
const SECTION_FIGURES = {
  "../site/js/figures/sessions.js": [
    "requests_per_session_cdf",
    "duration_cdf",
    "tokens_per_request_cdf",
    "token_split_by_week",
    "token_growth_by_messages",
    "context_share_by_role",
    "ttft_cdf_by_model",
  ],
  "../site/js/figures/tools.js": [
    "latency_by_category",
    "result_tokens_by_category",
  ],
  "../site/js/figures/caching.js": [
    "hit_ratio_by_idle_gap",
    "hit_ratio_by_transition",
    "simulated_hit_ratio_by_ttl",
    "dead_over_active_by_policy",
  ],
};

// The figures of every section, as each module exports them, each list with its module's path.
async function sections() {
  const loaded = [];
  for (const [path, names] of Object.entries(SECTION_FIGURES)) {
    const { FIGURES } = await import(path);
    loaded.push({ path, names, figures: FIGURES });
  }
  return loaded;
}

test("each section lists its figures in order, and no list can be changed", async () => {
  for (const { path, names, figures } of await sections()) {
    assert.deepEqual(figures.map((figure) => figure.name), names, path);
    assert.ok(Object.isFrozen(figures), path);
    for (const figure of figures) {
      assert.ok(Object.isFrozen(figure), figure.name);
    }
  }
});

test("every figure runs the query of its own name, and that query file exists", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures) {
      assert.equal(figure.query, `figures/${figure.name}`);
      assert.ok(existsSync(new URL(`${figure.query}.sql`, QUERIES_FOLDER)), `${figure.query}.sql`);
    }
  }
});

test("every figure has a title, a one-sentence definition, a bin column and a draw function", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures) {
      assert.ok(figure.title.length > 0, figure.name);
      assert.ok(figure.definition.endsWith("."), figure.name);
      assert.equal(figure.definition.split(". ").length, 1, `${figure.name}: one sentence`);
      assert.ok(typeof figure.binColumn === "string" || figure.binColumn === null, figure.name);
      assert.equal(typeof figure.draw, "function", figure.name);
    }
  }
});

test("no figure name is used twice, so every element id is unique", async () => {
  const names = (await sections()).flatMap((section) => section.names);
  assert.equal(new Set(names).size, names.length);
});
