import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { FIGURE_SECTIONS } from "../site/js/explore/figure_sections.js";
import { assignColours } from "../site/js/theme/colours.js";

// The site's query folder; a figure's query `figures/<name>` is the file `figures/<name>.sql` in it.
const QUERIES_FOLDER = new URL("../site/queries/", import.meta.url);

// Each figure section module of the Explore page, in the page's order, with the figures it draws, in order.
const SECTION_FIGURES = {
  "../site/js/figures/sessions.js": [
    "requests_per_session_cdf",
    "duration_cdf",
    "subagents_per_session",
    "user_prompt_tokens_by_scope",
  ],
  "../site/js/figures/tokens.js": [
    "tokens_per_request_cdf",
    "token_split_by_week",
    "token_growth_by_messages",
    "context_share_by_role",
    "cached_fraction_per_request",
    "cost_share_by_session",
  ],
  "../site/js/figures/latency.js": [
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
    "tool_mix_by_turn_position",
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
  ],
};

// The figure sections of index.html, in order: each section's id, its number and its heading.
const PAGE_SECTIONS = [
  { id: "figures-sessions", number: "01", heading: "Sessions" },
  { id: "figures-tokens", number: "02", heading: "Tokens and cost" },
  { id: "figures-latency", number: "03", heading: "Latency" },
  { id: "figures-tools", number: "04", heading: "Tools" },
  { id: "figures-caching", number: "05", heading: "Prefix caching" },
  { id: "figures-comparison", number: "06", heading: "Human-driven against benchmark" },
];
const PAGE = readFileSync(new URL("../site/index.html", import.meta.url), "utf8");
const PAGE_SECTION =
  /<section id="(figures-\w+)" class="figure-section"[^>]*>\s*<h2[^>]*><span class="topic-number">(\d+)<\/span>([^<]+)<\/h2>/g;

// A histogram figure names its stats query beside its bins query; every other figure is drawn from one query.
function isHistogram(figure) {
  return figure.statsQuery !== undefined;
}

// Every figure of every section.
async function everyFigure() {
  return (await sections()).flatMap((section) => section.figures);
}

// Every figure of every section that is drawn from one query, as the chart tests below read them.
async function chartFigures() {
  return (await everyFigure()).filter((figure) => !isHistogram(figure));
}

// The figures of every section, as each module exports them, each list with its module's path.
async function sections() {
  const loaded = [];
  for (const [path, names] of Object.entries(SECTION_FIGURES)) {
    const { FIGURES } = await import(path);
    loaded.push({ path, names, figures: FIGURES });
  }
  return loaded;
}

test("the page holds the six figure sections in order, each with its number and heading", () => {
  const found = [...PAGE.matchAll(PAGE_SECTION)].map((match) => ({ id: match[1], number: match[2], heading: match[3] }));
  assert.deepEqual(found, PAGE_SECTIONS);
});

test("a figure section holds its heading and its cards, and no intro text", () => {
  for (const { id } of PAGE_SECTIONS) {
    const start = PAGE.indexOf(`<section id="${id}"`);
    const section = PAGE.slice(start, PAGE.indexOf("</section>", start));
    const tags = [...section.matchAll(/<(\w+)[\s>]/g)].map((match) => match[1]);
    assert.deepEqual(tags, ["section", "h2", "span", "div"], id);
  }
});

test("the runner fills each section of the page from its section module, in the page's order", () => {
  assert.deepEqual(FIGURE_SECTIONS.map((section) => section.selector), PAGE_SECTIONS.map((section) => `#${section.id}`));
  const modules = Object.keys(SECTION_FIGURES).map((path) => path.replace("../site/js/", "../"));
  assert.deepEqual(FIGURE_SECTIONS.map((section) => section.module), modules);
});

test("each section lists its figures in order, and no list can be changed", async () => {
  for (const { path, names, figures } of await sections()) {
    assert.deepEqual(figures.map((figure) => figure.name), names, path);
    assert.ok(Object.isFrozen(figures), path);
    for (const figure of figures) {
      assert.ok(Object.isFrozen(figure), figure.name);
    }
  }
});

test("every chart runs the query of its own name, and that query file exists", async () => {
  for (const figure of await chartFigures()) {
    assert.equal(figure.query, `figures/${figure.name}`);
    assert.ok(existsSync(new URL(`${figure.query}.sql`, QUERIES_FOLDER)), `${figure.query}.sql`);
  }
});

test("every histogram runs a bins and a stats query of one Explore name, and both query files exist", async () => {
  const histograms = (await sections()).flatMap((section) => section.figures.filter(isHistogram));
  assert.deepEqual(histograms.map((figure) => figure.name), ["subagents_per_session", "cached_fraction_per_request"]);
  for (const figure of histograms) {
    const prefix = figure.query.replace(/_bins$/, "");
    assert.ok(prefix.startsWith("explore/"), figure.name);
    assert.equal(figure.statsQuery, `${prefix}_stats`, figure.name);
    for (const query of [figure.query, figure.statsQuery]) {
      assert.ok(existsSync(new URL(`${query}.sql`, QUERIES_FOLDER)), `${query}.sql`);
    }
    assert.equal(typeof figure.logScale, "boolean", figure.name);
    assert.equal(typeof figure.format, "function", figure.name);
    assert.equal(figure.draw, undefined, `${figure.name}: shared/histogram.js draws it`);
  }
});

test("every chart has a bin column and a draw function", async () => {
  for (const figure of await chartFigures()) {
    assert.ok(typeof figure.binColumn === "string" || figure.binColumn === null, figure.name);
    assert.equal(typeof figure.draw, "function", figure.name);
  }
});

// A sentence ends at a full stop, a question mark or an exclamation mark followed by a space; a line break also
// starts a new one.
const SENTENCE_BREAK = /[.?!] |\n/;

// Whether `text` is one sentence: no sentence break before its end.
function isOneSentence(text) {
  return text.split(SENTENCE_BREAK).length === 1;
}

test("every figure has a title and a one-sentence definition", async () => {
  for (const figure of await everyFigure()) {
    assert.ok(figure.title.length > 0, figure.name);
    assert.ok(figure.definition.endsWith("."), figure.name);
    assert.ok(isOneSentence(figure.definition), `${figure.name}: one sentence`);
  }
});

const MAX_CAPTION_WORDS = 12; // a caption is one line a reader takes in at a glance
const MAX_DEFINITION_WORDS = 40; // a definition says what is drawn and its one difference from the paper, no more

// The words of `text`: its whitespace-separated tokens.
function wordCount(text) {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

test("a second sentence is found after a full stop, a question or an exclamation, or a line break", () => {
  assert.equal(isOneSentence("One sentence, at 4.5 s."), true);
  for (const text of ["One. Two.", "One? Two.", "One! Two.", "One\nTwo."]) {
    assert.equal(isOneSentence(text), false, text);
  }
});

test("a word is a whitespace-separated token", () => {
  assert.equal(wordCount("Tool call latency per category, box 25th–75th."), 7);
  assert.equal(wordCount("  two\n words "), 2);
});

test("every figure has a caption of one short sentence, at most twelve words", async () => {
  for (const figure of await everyFigure()) {
    assert.equal(typeof figure.caption, "string", `${figure.name} has a caption`);
    assert.ok(figure.caption.length > 0, `${figure.name}: a caption that says something`);
    assert.ok(figure.caption.endsWith("."), figure.name);
    assert.ok(isOneSentence(figure.caption), `${figure.name}: one sentence`);
    const words = wordCount(figure.caption);
    assert.ok(words <= MAX_CAPTION_WORDS, `${figure.name}: a caption of ${words} words`);
  }
});

test("every figure's definition is at most forty words", async () => {
  for (const figure of await everyFigure()) {
    const words = wordCount(figure.definition);
    assert.ok(words <= MAX_DEFINITION_WORDS, `${figure.name}: a definition of ${words} words`);
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
  for (const figure of await chartFigures()) {
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
