import assert from "node:assert/strict";
import { test } from "node:test";

import { FIGURE_SECTIONS } from "../site/js/explore/figure_sections.js";

// The folder `FIGURE_SECTIONS` names its modules from.
const EXPLORE_FOLDER = new URL("../site/js/explore/", import.meta.url);

// The figures and the takeaway of every section the page draws, each with its module's path.
async function sections() {
  const loaded = [];
  for (const section of FIGURE_SECTIONS) {
    const { FIGURES, TAKEAWAY } = await import(new URL(section.module, EXPLORE_FOLDER));
    loaded.push({ path: section.module, figures: FIGURES, takeaway: TAKEAWAY });
  }
  return loaded;
}

// Every figure of every section.
async function everyFigure() {
  return (await sections()).flatMap((section) => section.figures);
}

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
const MAX_INSIGHT_WORDS = 12; // an insight is the card's point, read before the chart
const MAX_TAKEAWAY_WORDS = 20; // a takeaway is the topic's finding, one line under its heading on a desktop
const MAX_DEFINITION_WORDS = 40; // a definition says what is drawn, no more

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

test("every insight a figure has is one short sentence, at most twelve words", async () => {
  for (const figure of await everyFigure()) {
    if (figure.insight === undefined) {
      continue;
    }
    assert.ok(figure.insight.endsWith("."), figure.name);
    assert.ok(isOneSentence(figure.insight), `${figure.name}: one sentence`);
    const words = wordCount(figure.insight);
    assert.ok(words <= MAX_INSIGHT_WORDS, `${figure.name}: an insight of ${words} words`);
  }
});

test("every section has a takeaway of one sentence, at most twenty words", async () => {
  for (const { path, takeaway } of await sections()) {
    assert.equal(typeof takeaway, "string", `${path} has a takeaway`);
    assert.ok(takeaway.endsWith("."), path);
    assert.ok(isOneSentence(takeaway), `${path}: one sentence`);
    const words = wordCount(takeaway);
    assert.ok(words <= MAX_TAKEAWAY_WORDS, `${path}: a takeaway of ${words} words`);
  }
});

test("every figure's definition is at most forty words", async () => {
  for (const figure of await everyFigure()) {
    const words = wordCount(figure.definition);
    assert.ok(words <= MAX_DEFINITION_WORDS, `${figure.name}: a definition of ${words} words`);
  }
});
