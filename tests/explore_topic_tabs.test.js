import assert from "node:assert/strict";
import { test } from "node:test";

import { showTopic, topicForHash, topicTab } from "../site/js/explore/topic_tabs.js";

// The topics' anchors on the page, in order.
const ANCHORS = [
  "insights-sessions", "insights-tokens", "insights-latency", "insights-tools", "insights-caching", "insights-comparison",
];

/** A stand-in for a tab or a section: its attributes, its classes, and the properties the tabs set. */
class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.attributes = new Map();
    this.classes = new Set();
    this.classList = { toggle: (name, isOn) => (isOn ? this.classes.add(name) : this.classes.delete(name)) };
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }
}

test("a tab is a button labelled with its topic's number and title, controlling its topic's section", () => {
  globalThis.document = { createElement: () => new FakeElement() };
  const tab = topicTab({ anchor: "insights-tokens", number: "02", title: "Tokens and cost" });
  delete globalThis.document;
  assert.equal(tab.type, "button");
  assert.equal(tab.className, "nav-link topic-tab");
  assert.equal(tab.getAttribute("role"), "tab");
  assert.equal(tab.getAttribute("aria-controls"), "insights-tokens");
  assert.equal(tab.textContent, "02 Tokens and cost");
});

test("a hash naming a topic shows that topic", () => {
  assert.equal(topicForHash("#insights-caching", ANCHORS, "insights-sessions"), "insights-caching");
  assert.equal(topicForHash("#insights-sessions", ANCHORS, "insights-tools"), "insights-sessions");
});

test("no hash, or the Insights' own anchor, shows the first topic", () => {
  assert.equal(topicForHash("", ANCHORS, "insights-tools"), "insights-sessions");
  assert.equal(topicForHash("#insights", ANCHORS, "insights-tools"), "insights-sessions");
});

test("a hash naming another section, or nothing on the page, leaves the shown topic as it is", () => {
  for (const hash of ["#sessions", "#cite", "#overview", "#duration_cdf", "#insights-unknown", "#tokens"]) {
    assert.equal(topicForHash(hash, ANCHORS, "insights-tools"), "insights-tools", hash);
  }
});

test("showing a topic hides every other topic and selects its tab alone", () => {
  const sections = ANCHORS.map((anchor) => new FakeElement(anchor));
  const tabs = ANCHORS.map((anchor) => {
    const tab = new FakeElement();
    tab.setAttribute("aria-controls", anchor);
    return tab;
  });
  showTopic(sections, tabs, "insights-latency");
  assert.deepEqual(sections.filter((section) => !section.hidden).map((section) => section.id), ["insights-latency"]);
  assert.deepEqual(tabs.map((tab) => tab.getAttribute("aria-selected")), [
    "false", "false", "true", "false", "false", "false",
  ]);
  assert.deepEqual(tabs.map((tab) => tab.classes.has("is-active")), [false, false, true, false, false, false]);
  showTopic(sections, tabs, "insights-sessions");
  assert.deepEqual(sections.filter((section) => !section.hidden).map((section) => section.id), ["insights-sessions"]);
  assert.equal(tabs[2].getAttribute("aria-selected"), "false");
  assert.equal(tabs[2].classes.has("is-active"), false);
});
