import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mountTopicTabs, showTopic, tabIndexForKey, topicForEntry, topicForHash, topicTab,
} from "../site/js/explore/topic_tabs.js";

// The topics' anchors on the page, in order.
const ANCHORS = [
  "insights-sessions", "insights-tokens", "insights-latency", "insights-tools", "insights-caching", "insights-comparison",
];

// The topics' titles, as their headings give them after the number.
const TITLES = ["Session structure", "Tokens and cost", "Latency", "Tools", "Prefix caching", "Human-driven"];

/** A stand-in for a tab, a section or the row: its attributes, its classes, its listeners and what the tabs set. */
class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.hidden = false;
    this.attributes = new Map();
    this.classes = new Set();
    this.listeners = new Map();
    this.children = [];
    this.classList = { toggle: (name, isOn) => (isOn ? this.classes.add(name) : this.classes.delete(name)) };
    this.scrollLeft = 0;
    this.clientWidth = 0;
    this.scrollWidth = 0;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name);
  }

  addEventListener(type, listener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  dispatch(type, event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  replaceChildren(...children) {
    this.children = children;
  }

  getBoundingClientRect() {
    return { left: 0, right: 0 };
  }

  focus() {
    globalThis.document.activeElement = this;
  }
}

/** A topic section as the page holds it: its heading the number's element, a space and the title's text node. */
function topicSection(anchor, index) {
  const section = new FakeElement(anchor);
  const number = { textContent: `0${index + 1}` };
  const heading = { querySelector: () => number, lastChild: { textContent: ` ${TITLES[index]}` } };
  section.querySelector = () => heading;
  return section;
}

/**
 * The browser's history as the tabs use it: entries of `{ state, hash }`, the current one's hash in `location.hash`,
 * and `back()`, which moves to the entry before and tells the window's listeners of `popstate`.
 */
class FakeHistory {
  constructor(window, hash) {
    this.window = window;
    this.entries = [{ state: null, hash }];
    this.index = 0;
  }

  get state() {
    return this.entries[this.index].state;
  }

  pushState(state, title, url) {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push({ state, hash: url });
    this.index += 1;
    this.window.location.hash = url;
  }

  replaceState(state, title, url = this.entries[this.index].hash) {
    this.entries[this.index] = { state, hash: url };
  }

  back() {
    this.index -= 1;
    this.window.location.hash = this.entries[this.index].hash;
    this.window.dispatch("popstate", { state: this.entries[this.index].state });
  }
}

/** Mount the tabs on a page opened at `hash`: `{ tabs, sections, history }`; the globals are the fakes until `done`. */
function mountedTabs(hash) {
  const sections = ANCHORS.map(topicSection);
  const window = new FakeElement();
  window.location = { hash };
  window.history = new FakeHistory(window, hash);
  globalThis.window = window;
  globalThis.ResizeObserver = class { observe() {} };
  globalThis.document = {
    querySelector: (selector) => sections.find((section) => `#${section.id}` === selector),
    getElementById: (id) => sections.find((section) => section.id === id),
    createElement: () => new FakeElement(),
  };
  const row = new FakeElement("topic-tabs");
  mountTopicTabs(row, ANCHORS.map((anchor) => ({ selector: `#${anchor}` })), () => undefined);
  return { tabs: row.children, sections, history: window.history };
}

function done() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.ResizeObserver;
}

function shownAnchors(sections) {
  return sections.filter((section) => !section.hidden).map((section) => section.id);
}

test("a tab is a button labelled with its topic's number and title, controlling its topic's section", () => {
  globalThis.document = { createElement: () => new FakeElement() };
  const tab = topicTab({ anchor: "insights-tokens", number: "02", title: "Tokens and cost" });
  delete globalThis.document;
  assert.equal(tab.type, "button");
  assert.equal(tab.id, "tab-insights-tokens");
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

test("a history entry's topic wins over its hash; an entry with none, or an unknown one, goes by the hash", () => {
  assert.equal(topicForEntry({ topic: "insights-sessions" }, "#sessions", ANCHORS, "insights-tools"), "insights-sessions");
  assert.equal(topicForEntry(null, "#insights-latency", ANCHORS, "insights-tools"), "insights-latency");
  assert.equal(topicForEntry({ topic: "gone" }, "#cite", ANCHORS, "insights-tools"), "insights-tools");
});

test("the arrow keys move to the next and the previous tab round the row, Home and End to its ends", () => {
  assert.equal(tabIndexForKey("ArrowRight", 2, 6), 3);
  assert.equal(tabIndexForKey("ArrowRight", 5, 6), 0);
  assert.equal(tabIndexForKey("ArrowLeft", 0, 6), 5);
  assert.equal(tabIndexForKey("Home", 4, 6), 0);
  assert.equal(tabIndexForKey("End", 1, 6), 5);
  assert.equal(tabIndexForKey("Tab", 1, 6), null);
  assert.equal(tabIndexForKey("Enter", 1, 6), null);
});

test("showing a topic hides every other topic and selects its tab alone, the row's one tab stop", () => {
  const sections = ANCHORS.map((anchor) => new FakeElement(anchor));
  const tabs = ANCHORS.map((anchor) => {
    const tab = new FakeElement();
    tab.setAttribute("aria-controls", anchor);
    return tab;
  });
  showTopic(sections, tabs, "insights-latency");
  assert.deepEqual(shownAnchors(sections), ["insights-latency"]);
  assert.deepEqual(tabs.map((tab) => tab.getAttribute("aria-selected")), [
    "false", "false", "true", "false", "false", "false",
  ]);
  assert.deepEqual(tabs.map((tab) => tab.tabIndex), [-1, -1, 0, -1, -1, -1]);
  assert.deepEqual(tabs.map((tab) => tab.classes.has("is-active")), [false, false, true, false, false, false]);
  showTopic(sections, tabs, "insights-sessions");
  assert.deepEqual(shownAnchors(sections), ["insights-sessions"]);
  assert.equal(tabs[2].getAttribute("aria-selected"), "false");
  assert.equal(tabs[2].classes.has("is-active"), false);
});

test("the tabs read their titles from the headings, after the number", () => {
  const { tabs } = mountedTabs("");
  done();
  assert.deepEqual(tabs.map((tab) => tab.textContent), TITLES.map((title, index) => `0${index + 1} ${title}`));
});

test("Back from the fourth topic shows the first again", () => {
  const { tabs, sections, history } = mountedTabs("");
  tabs[3].dispatch("click", {});
  assert.deepEqual(shownAnchors(sections), ["insights-tools"]);
  assert.equal(globalThis.window.location.hash, "#insights-tools");
  history.back();
  done();
  assert.deepEqual(shownAnchors(sections), ["insights-sessions"]);
});

test("Back shows the first topic again on a page opened at another section's anchor", () => {
  const { tabs, sections, history } = mountedTabs("#sessions");
  tabs[2].dispatch("click", {});
  assert.deepEqual(shownAnchors(sections), ["insights-latency"]);
  history.back();
  done();
  assert.deepEqual(shownAnchors(sections), ["insights-sessions"]);
  assert.equal(history.entries[0].hash, "#sessions");
});

test("ArrowRight on the shown tab shows the next topic and focuses its tab; Back returns", () => {
  const { tabs, sections, history } = mountedTabs("#insights-tokens");
  let isDefaultPrevented = false;
  tabs[1].dispatch("keydown", { key: "ArrowRight", preventDefault: () => { isDefaultPrevented = true; } });
  assert.equal(isDefaultPrevented, true);
  assert.deepEqual(shownAnchors(sections), ["insights-latency"]);
  assert.equal(globalThis.document.activeElement, tabs[2]);
  assert.deepEqual(tabs.map((tab) => tab.tabIndex), [-1, -1, 0, -1, -1, -1]);
  history.back();
  done();
  assert.deepEqual(shownAnchors(sections), ["insights-tokens"]);
});

test("Tab is left to the browser, so focus leaves the row", () => {
  const { tabs, sections } = mountedTabs("");
  let isDefaultPrevented = false;
  tabs[0].dispatch("keydown", { key: "Tab", preventDefault: () => { isDefaultPrevented = true; } });
  done();
  assert.equal(isDefaultPrevented, false);
  assert.deepEqual(shownAnchors(sections), ["insights-sessions"]);
});
