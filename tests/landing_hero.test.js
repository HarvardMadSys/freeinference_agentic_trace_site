import assert from "node:assert/strict";
import { test } from "node:test";

import { renderHero } from "../site/js/landing/hero.js";
import { weekCountText } from "../site/js/shared/layout.js";

test("the lede's first words count the weeks in digits, one week in the singular, and name none it does not know", () => {
  assert.equal(weekCountText(16), "16 weeks");
  assert.equal(weekCountText(1), "1 week");
  assert.equal(weekCountText(null), "Weeks");
});

test("the hero's five buttons and the lab's name lead to their addresses", () => {
  const container = { innerHTML: "" };
  renderHero(container, 16);
  const buttons = [...container.innerHTML.matchAll(/<a class="button[^"]*" href="([^"]*)"[^>]*>([^<]*)<\/a>/g)];
  assert.deepEqual(buttons.map((match) => [match[2], match[1]]), [
    ["Session Explorer", "#sessions"],
    ["Insights", "#insights"],
    ["Dataset", "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace"],
    ["Paper", "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf"],
    ["Code", "https://github.com/HarvardMadSys/freeinference_agentic_trace"],
  ]);
  assert.match(container.innerHTML, /<a class="affiliation" href="https:\/\/madsys\.seas\.harvard\.edu\/" target="_blank" rel="noopener">/);
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
