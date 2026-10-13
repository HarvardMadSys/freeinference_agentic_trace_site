import assert from "node:assert/strict";
import { test } from "node:test";

import { renderHero } from "../site/js/landing/hero.js";

test("the hero holds the dataset's name as its title, the lede and the five buttons", () => {
  const container = { innerHTML: "" };
  renderHero(container);
  assert.doesNotMatch(container.innerHTML, /class="eyebrow"/);
  assert.match(container.innerHTML, /^\s*<h1 id="hero-title">FreeInference <em>Agentic Dataset<\/em><\/h1>/);
  assert.match(container.innerHTML, /<p class="hero-lede">Production agent traces from FreeInference across 13 diverse agent harnesses, /);
  assert.doesNotMatch(container.innerHTML, /anonymised/);
  const buttons = [...container.innerHTML.matchAll(/<a class="button[^"]*" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.map((match) => [match[2], match[1]]), [
    ["Session Explorer", "#sessions"],
    ["Insights", "#insights"],
    ["Dataset", "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace"],
    ["Paper", "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf"],
    ["Code", "https://github.com/HarvardMadSys/freeinference_agentic_trace"],
  ]);
});

test("the two site buttons come first, the Session Explorer's the primary one, and open on this tab", () => {
  const container = { innerHTML: "" };
  renderHero(container);
  const buttons = [...container.innerHTML.matchAll(/<a class="([^"]*)" href="[^"]*"([^>]*)>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.slice(0, 2).map((match) => [match[3], match[1], match[2]]), [
    ["Session Explorer", "button button--primary", ""],
    ["Insights", "button", ""],
  ]);
  assert.equal(container.innerHTML.split("button--primary").length - 1, 1);
});
