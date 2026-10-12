import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { assignColours } from "../site/js/theme/colours.js";

// The site's query folder; a figure's query `figures/<name>` is the file `figures/<name>.sql` in it.
const QUERIES_FOLDER = new URL("../site/queries/", import.meta.url);

// Each figure section module of the Explore page, with the figures it draws, in order.
const SECTION_FIGURES = {
  "../site/js/figures/sessions.js": [
    "requests_per_session_cdf",
    "duration_cdf",
    "tokens_per_request_cdf",
    "cost_share_by_session",
    "token_split_by_week",
    "token_growth_by_messages",
    "context_share_by_role",
    "ttft_cdf_by_model",
    "decode_cdf_by_model",
    "session_time_by_part",
    "speedup_if_twice_as_fast",
  ],
  "../site/js/figures/tools.js": [
    "latency_by_category",
    "result_tokens_by_category",
    "calls_per_request_by_category",
    "latency_by_batch_width",
  ],
  "../site/js/figures/caching.js": [
    "hit_ratio_cdf_by_gap_bin",
    "hit_ratio_by_idle_gap",
    "gap_cdf_by_cause",
    "mean_hit_ratio_by_cause",
    "hit_ratio_cdf_by_transition",
    "mutations_by_cause",
    "prefill_against_storage",
    "api_cost_by_ttl",
    "infrastructure_cost_by_ttl",
  ],
  "../site/js/comparison/comparison.js": [
    "turn_duration_by_scope",
    "session_duration_by_scope",
    "input_per_request_by_scope",
    "user_prompt_tokens_by_scope",
    "tool_mix_by_turn_position",
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

const MAX_CAPTION_LENGTH = 90; // characters: a caption under this is about a line of a card at desktop width

test("every figure has a caption of one short sentence, under the length of a line", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures) {
      assert.equal(typeof figure.caption, "string", `${figure.name} has a caption`);
      assert.ok(figure.caption.length > 0, `${figure.name}: a caption that says something`);
      assert.ok(figure.caption.endsWith("."), figure.name);
      assert.equal(figure.caption.split(". ").length, 1, `${figure.name}: one sentence`);
      assert.ok(figure.caption.length <= MAX_CAPTION_LENGTH, `${figure.name}: ${figure.caption.length} characters`);
    }
  }
});

// A figure entry holds more than one series when it names a series column (long format: its rows each name their
// series) or has a legend; a wide-format figure, whose series are columns, has a legend and a draw function that takes
// the hidden set as a fourth argument.
function isLongFormat(figure) {
  return figure.seriesColumn !== undefined;
}

function hasLegend(figure) {
  return typeof figure.legend === "function";
}

// A draw function's `length` counts its parameters before the first default, so a wide-format draw function declares
// `hidden` as a plain fourth parameter: given a default, it would not be counted and the figure would not be seen as
// wide format.
function isWideFormat(figure) {
  return figure.draw.length === 4;
}

test("a figure of more than one series has a legend, and a series column unless its series are columns", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures) {
      if (isLongFormat(figure)) {
        assert.ok(hasLegend(figure), `${figure.name}: names a series column, so it needs a legend`);
        assert.equal(typeof figure.seriesColumn, "string", figure.name);
        assert.ok(!isWideFormat(figure), `${figure.name}: a long-format figure is drawn from the shown rows alone`);
      }
      if (hasLegend(figure)) {
        assert.ok(isLongFormat(figure) || isWideFormat(figure),
          `${figure.name}: has a legend, so it needs a series column or a draw function that takes the hidden set`);
      }
      if (isWideFormat(figure)) {
        assert.ok(hasLegend(figure), `${figure.name}: takes the hidden set, so it needs a legend`);
      }
    }
  }
});

test("a figure whose bins are its series, as every CDF's are, names that column as its series column", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures.filter((one) => one.binColumn === "series")) {
      assert.equal(figure.seriesColumn, "series", figure.name);
    }
  }
});

// The colours every figure shares, as the page gives a legend function; no model, whose label is its name.
const FIGURE_COLOURS = Object.freeze({ models: new Map(), categories: new Map(), providers: new Map([["A", "red"]]) });

test("every legend label is capitalised, as a sentence starts", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures.filter(hasLegend)) {
      // The rows name every series the legend could list, so the legend lists them all.
      const { colours } = figure.legend([], FIGURE_COLOURS, figure.seriesColumn);
      const rows = [...colours.keys()].map((name) => ({ [figure.seriesColumn]: name }));
      for (const { label } of figure.legend(rows, FIGURE_COLOURS, figure.seriesColumn).series) {
        assert.equal(label[0], label[0].toUpperCase(), `${figure.name}: ${label}`);
      }
    }
  }
});

// Ten names of each kind in their order over every week, so the ninth and tenth of each take the Other grey.
const TEN_NAMES = ["n1", "n2", "n3", "n4", "n5", "n6", "n7", "n8", "n9", "n10"];
const TEN_OF_EACH = Object.freeze({
  models: assignColours(TEN_NAMES),
  categories: assignColours(TEN_NAMES),
  providers: assignColours(TEN_NAMES),
});

// Rows naming, in `seriesColumn`, every name a legend could list: each of the ten and each series of its own colours.
function rowsOfEverySeries(figure) {
  const names = new Set([...TEN_NAMES, ...figure.legend([], TEN_OF_EACH, figure.seriesColumn).colours.keys()]);
  return [...names].map((name) => ({ [figure.seriesColumn]: name }));
}

test("no two series of a figure's legend share a colour, even when the rows hold more than eight", async () => {
  for (const { figures } of await sections()) {
    for (const figure of figures.filter(hasLegend)) {
      const legend = figure.legend(rowsOfEverySeries(figure), TEN_OF_EACH, figure.seriesColumn);
      const swatches = legend.series.map((one) => legend.colours.get(one.name));
      assert.equal(new Set(swatches).size, swatches.length, `${figure.name}: ${swatches.join(", ")}`);
    }
  }
});

test("no figure name is used twice, so every element id is unique", async () => {
  const names = (await sections()).flatMap((section) => section.names);
  assert.equal(new Set(names).size, names.length);
});
