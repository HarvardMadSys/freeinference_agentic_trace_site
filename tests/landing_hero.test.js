import assert from "node:assert/strict";
import { test } from "node:test";

import { countInWords, ledeLead, renderHero } from "../site/js/landing/hero.js";

test("a count under a hundred is written in words, a larger one in digits", () => {
  assert.equal(countInWords(1), "one");
  assert.equal(countInWords(16), "sixteen");
  assert.equal(countInWords(20), "twenty");
  assert.equal(countInWords(21), "twenty-one");
  assert.equal(countInWords(52), "fifty-two");
  assert.equal(countInWords(99), "ninety-nine");
  assert.equal(countInWords(104), "104");
});

test("the lede's first clause counts the weeks, one week in the singular, and names none it does not know", () => {
  assert.equal(ledeLead(16), "Sixteen weeks of coding agents,");
  assert.equal(ledeLead(1), "One week of coding agents,");
  assert.equal(ledeLead(52), "Fifty-two weeks of coding agents,");
  assert.equal(ledeLead(null), "Weeks of coding agents,");
});

test("the hero holds the dataset's name as its title, the lede counting the weeks and the four buttons", () => {
  const container = { innerHTML: "" };
  renderHero(container, 16);
  assert.doesNotMatch(container.innerHTML, /class="eyebrow"/);
  assert.match(container.innerHTML, /^\s*<h1 id="hero-title">FreeInference <em>Agentic Dataset<\/em><\/h1>/);
  assert.match(container.innerHTML, /<p class="hero-lede">Sixteen weeks of coding agents, anonymised: /);
  const buttons = [...container.innerHTML.matchAll(/<a class="button[^"]*" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.map((match) => [match[2], match[1]]), [
    ["Insights", "#insights"],
    ["Dataset", "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace"],
    ["Paper", "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf"],
    ["Code", "https://github.com/HarvardMadSys/freeinference_agentic_trace"],
  ]);
});
