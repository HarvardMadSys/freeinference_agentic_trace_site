import assert from "node:assert/strict";
import { test } from "node:test";

import { countInWords, renderHero, titleLead } from "../site/js/landing/hero.js";

test("a count under a hundred is written in words, a larger one in digits", () => {
  assert.equal(countInWords(1), "one");
  assert.equal(countInWords(16), "sixteen");
  assert.equal(countInWords(20), "twenty");
  assert.equal(countInWords(21), "twenty-one");
  assert.equal(countInWords(52), "fifty-two");
  assert.equal(countInWords(99), "ninety-nine");
  assert.equal(countInWords(104), "104");
});

test("the title's first phrase counts the weeks, one week in the singular, and names none it does not know", () => {
  assert.equal(titleLead(16), "Sixteen weeks of coding agents,");
  assert.equal(titleLead(1), "One week of coding agents,");
  assert.equal(titleLead(52), "Fifty-two weeks of coding agents,");
  assert.equal(titleLead(null), "Weeks of coding agents,");
});

test("the hero holds the eyebrow, the title with its accent phrase and the four buttons, the first to the Insights", () => {
  const container = { innerHTML: "" };
  renderHero(container, 16);
  assert.match(container.innerHTML, /FreeInference agentic trace<\/p>/);
  assert.match(container.innerHTML, /<h1 id="hero-title">Sixteen weeks of coding agents, <br><em>request by request\.<\/em><\/h1>/);
  const buttons = [...container.innerHTML.matchAll(/<a class="button[^"]*" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.map((match) => [match[2], match[1]]), [
    ["Insights", "#insights"],
    ["Dataset", "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace"],
    ["Paper", "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf"],
    ["Code", "https://github.com/HarvardMadSys/freeinference_agentic_trace"],
  ]);
});
