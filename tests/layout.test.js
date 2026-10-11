import assert from "node:assert/strict";
import { test } from "node:test";

import { renderHeader } from "../site/js/shared/layout.js";

// The header's links as `[title, href, active]`, read from the markup `renderHeader` writes into a stand-in container.
function headerLinks(activeFile, params) {
  const container = { innerHTML: "" };
  renderHeader(container, activeFile, params);
  const links = [];
  for (const match of container.innerHTML.matchAll(/<a class="nav-link( is-active)?" href="([^"]*)">([^<]*)<\/a>/g)) {
    links.push([match[3], match[2], match[1] !== undefined]);
  }
  return links;
}

test("the header links Explore, each figure section, its sessions table and About, each carrying the selection", () => {
  assert.deepEqual(headerLinks("session.html", new URLSearchParams("month=2026-07")), [
    ["Explore", "index.html?month=2026-07", false],
    ["Sessions", "index.html?month=2026-07#figures-sessions", false],
    ["Tools", "index.html?month=2026-07#figures-tools", false],
    ["Caching", "index.html?month=2026-07#figures-caching", false],
    ["Sessions table", "index.html?month=2026-07#sessions", false],
    ["About", "about.html?month=2026-07", false],
  ]);
});

test("on the Explore page only the Explore link is marked active, not the links to its sections", () => {
  const active = headerLinks("index.html", new URLSearchParams()).filter((link) => link[2]);
  assert.deepEqual(active, [["Explore", "index.html", true]]);
});

test("on the Explore page its sections are linked by anchor alone, so following one does not load the page again", () => {
  assert.deepEqual(headerLinks("index.html", new URLSearchParams("month=2026-07&sort=requests&page=2")), [
    ["Explore", "index.html?month=2026-07&sort=requests&page=2", true],
    ["Sessions", "#figures-sessions", false],
    ["Tools", "#figures-tools", false],
    ["Caching", "#figures-caching", false],
    ["Sessions table", "#sessions", false],
    ["About", "about.html?month=2026-07&sort=requests&page=2", false],
  ]);
});
