import assert from "node:assert/strict";
import { test } from "node:test";

import { ledeOpening, renderHero } from "../site/js/landing/hero.js";

test("the lede's first words count the weeks in digits, one week in the singular, and name none it does not know", () => {
  assert.equal(ledeOpening(16), "16 weeks");
  assert.equal(ledeOpening(1), "1 week");
  assert.equal(ledeOpening(null), "Weeks");
});

test("the hero holds the dataset's name as its title, the lede counting the weeks, the five buttons and the lab's name", () => {
  const container = { innerHTML: "" };
  renderHero(container, 16);
  assert.doesNotMatch(container.innerHTML, /class="eyebrow"/);
  assert.match(container.innerHTML, /^\s*<h1 id="hero-title">FreeInference <em>Agentic Dataset<\/em><\/h1>/);
  assert.match(container.innerHTML, /<p class="hero-lede">16 weeks worth of production agent traces from FreeInference across diverse agent harnesses, with latency, tool, and KV block information\.<\/p>/);
  assert.match(container.innerHTML, /<p class="hero-affiliation"><a class="affiliation" href="https:\/\/madsys\.seas\.harvard\.edu\/" target="_blank" rel="noopener">Harvard SEAS · MadSys Lab<\/a><\/p>\s*$/);
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
  renderHero(container, 16);
  const buttons = [...container.innerHTML.matchAll(/<a class="([^"]*)" href="[^"]*"([^>]*)>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.slice(0, 2).map((match) => [match[3], match[1], match[2]]), [
    ["Session Explorer", "button button--primary", ""],
    ["Insights", "button", ""],
  ]);
  assert.equal(container.innerHTML.split("button--primary").length - 1, 1);
});
