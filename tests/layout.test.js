import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { LINKED_SECTIONS, renderFooter, renderHeader, queryString } from "../site/js/shared/layout.js";

// The Explore page, whose sections the header and footer link by anchor.
const EXPLORE_PAGE = new URL("../site/index.html", import.meta.url);

// The URL keys of the sessions table, as a page gives them to the header and footer.
const TABLE_KEYS = "months=2026-07&harnesses=codex&sort=requests&page=2";

// The markup `render` writes into a stand-in container for the page `activeFile` with the URL keys `query`.
function rendered(render, activeFile, query, weekCount = 16) {
  const container = { innerHTML: "" };
  render(container, activeFile, new URLSearchParams(query), weekCount);
  return container.innerHTML;
}

// The header's links to the Explore page's sections as `[title, href, marked]`; a marked link names where the page
// was opened from.
function sectionLinks(activeFile, query) {
  const links = [];
  const markup = rendered(renderHeader, activeFile, query);
  const pattern = /<a class="nav-link( is-active)?" href="([^"]*)"( aria-current="true")?>([^<]*)<\/a>/g;
  for (const match of markup.matchAll(pattern)) {
    assert.equal(match[1] !== undefined, match[3] !== undefined, `${match[4]} is marked without aria-current`);
    links.push([match[4], match[2], match[1] !== undefined]);
  }
  return links;
}

// The links of `markup` that open in a new tab, as `[title, href]`.
function externalLinks(markup) {
  const links = [];
  for (const match of markup.matchAll(/<a class="[^"]*" href="([^"]*)" target="_blank" rel="noopener">([^<]*)<\/a>/g)) {
    links.push([match[2], match[1]]);
  }
  return links;
}

// The titles of the footer's links under the heading `heading`.
function footerList(heading) {
  const markup = rendered(renderFooter, "index.html", "");
  const list = markup.split(`<p class="footer-nav-title">${heading}</p>`)[1].split("</nav>")[0];
  return [...list.matchAll(/>([^<]+)<\/a>/g)].map((match) => match[1]);
}

test("on the Explore page the header links its four sections by anchor alone, none marked", () => {
  assert.deepEqual(sectionLinks("index.html", TABLE_KEYS), [
    ["Overview", "#overview", false],
    ["Session Explorer", "#sessions", false],
    ["Insights", "#insights", false],
    ["Cite", "#cite", false],
  ]);
});

test("on the Session page the header's section links carry the table's keys, and Session Explorer is marked", () => {
  assert.deepEqual(sectionLinks("session.html", TABLE_KEYS), [
    ["Overview", `index.html?${TABLE_KEYS}#overview`, false],
    ["Session Explorer", `index.html?${TABLE_KEYS}#sessions`, true],
    ["Insights", `index.html?${TABLE_KEYS}#insights`, false],
    ["Cite", `index.html?${TABLE_KEYS}#cite`, false],
  ]);
});

test("the brand links the Explore page with the URL keys", () => {
  const markup = rendered(renderHeader, "session.html", "months=2026-07");
  assert.match(markup, /<a class="brand" href="index\.html\?months=2026-07">/);
  assert.match(markup, /FreeInference <em>Agentic Dataset<\/em>/);
});

test("the header links nothing off the site", () => {
  assert.deepEqual(externalLinks(rendered(renderHeader, "index.html", "")), []);
});

test("the header links no About page", () => {
  assert.doesNotMatch(rendered(renderHeader, "index.html", ""), /about\.html|>About</);
});

test("the footer names the lab under its line, linking to it", () => {
  const markup = rendered(renderFooter, "index.html", "");
  assert.match(markup, /<a class="affiliation" href="https:\/\/madsys\.seas\.harvard\.edu\/" target="_blank" rel="noopener">Harvard SEAS · MadSys Lab<\/a>/);
});

test("the footer lists the sections on this site and the places elsewhere", () => {
  assert.deepEqual(footerList("On this site"), ["Overview", "Session Explorer", "Insights", "Cite"]);
  assert.deepEqual(footerList("Elsewhere"), [
    "Dataset", "Paper", "Code (this trace)", "Open Data", "FreeInference", "MadSys on GitHub",
  ]);
});

test("the footer's section links lead where the header's do, with the URL keys from the Session page", () => {
  const markup = rendered(renderFooter, "session.html", "months=2026-07");
  const links = [...markup.matchAll(/<a class="footer-link" href="([^"]*)">([^<]*)<\/a>/g)];
  assert.deepEqual(links.map((match) => [match[2], match[1]]), [
    ["Overview", "index.html?months=2026-07#overview"],
    ["Session Explorer", "index.html?months=2026-07#sessions"],
    ["Insights", "index.html?months=2026-07#insights"],
    ["Cite", "index.html?months=2026-07#cite"],
  ]);
});

test("the footer holds the brand, its line and the two lists of links, and nothing else", () => {
  const markup = rendered(renderFooter, "index.html", "");
  assert.match(markup, /FreeInference <em>Agentic Dataset<\/em>/);
  assert.match(markup, /<p>16 weeks worth of coding agent traces from FreeInference\.<\/p>/);
  const titles = [...markup.matchAll(/<p class="footer-nav-title">([^<]+)<\/p>/g)].map((match) => match[1]);
  assert.deepEqual(titles, ["On this site", "Elsewhere"]);
  assert.doesNotMatch(markup, /<h[1-6]/, "the footer's list titles are no headings");
  assert.doesNotMatch(markup, /Copyright|Accessibility|footer-legal/);
});

test("the Explore page is the site's one page of sections, titled with the dataset's name and run by its module", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  assert.match(page, /<title>FreeInference Agentic Dataset<\/title>/);
  assert.match(page, /<script type="module" src="js\/pages\/explore\.js"><\/script>/);
  for (const section of LINKED_SECTIONS) {
    assert.match(page, new RegExp(`<section id="${section.anchor.slice(1)}"`), `index.html has no section ${section.anchor}`);
  }
});

test("the Explore page runs Overview, Session Explorer, Insights, Cite and Team, each of the four a heading alone", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  const order = [...page.matchAll(/<section (?:id="([a-z-]+)" )?class="([a-z -]+)"/g)].map((match) => match[1] ?? match[2]);
  assert.deepEqual(order, [
    "hero", "overview", "sessions", "insights", "insights-sessions", "insights-tokens", "insights-latency",
    "insights-tools", "insights-caching", "insights-comparison", "cite", "team",
  ]);
  for (const section of LINKED_SECTIONS) {
    const start = page.indexOf(`<section id="${section.anchor.slice(1)}"`);
    const firstHeading = page.slice(start).match(/<h2 id="[^"]+">([^<]+)<\/h2>/)[1];
    assert.equal(firstHeading, section.title, section.anchor);
  }
  assert.doesNotMatch(page, /class="eyebrow"/);
});

test("the Session Explorer's line under its heading says what a click does, and no line says what a month holds", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  const section = page.slice(page.indexOf('<section id="sessions"'), page.indexOf('<section id="insights"'));
  const heading = '<h2 id="session-list-heading">Session Explorer</h2>';
  const guide = '<p class="section-guide">Click a session to open its requests, context and timeline.</p>';
  assert.ok(section.includes(`${heading}\n        ${guide}`), "the guide line is not under the heading");
  assert.ok(section.indexOf(guide) < section.indexOf('<div id="sessions-table"'));
  const table = readFileSync(new URL("../site/js/explore/sessions_table.js", import.meta.url), "utf8");
  assert.doesNotMatch(page + table, /A month holds/);
});

test("the Session page's link back reads Session Explorer and opens the Explore page at it", () => {
  const page = readFileSync(new URL("../site/session.html", import.meta.url), "utf8");
  assert.match(page, /<a id="back-link" href="index\.html#sessions">← Session Explorer<\/a>/);
  const module = readFileSync(new URL("../site/js/pages/session.js", import.meta.url), "utf8");
  assert.ok(module.includes("`index.html${queryString(selection)}#sessions`"), "the link back drops the table's keys");
});

test("the footer's line counts the weeks in digits as the hero's lede does, and says Weeks while the count is unknown", () => {
  assert.match(rendered(renderFooter, "index.html", "", 17), /<p>17 weeks worth of coding agent traces from FreeInference\.<\/p>/);
  assert.match(rendered(renderFooter, "index.html", "", 1), /<p>1 week worth of coding agent traces/);
  assert.match(rendered(renderFooter, "session.html", "", null), /<p>Weeks worth of coding agent traces/);
});

test("the query string keeps the commas of a list of names plain", () => {
  const params = new URLSearchParams("sort=requests");
  params.set("harnesses", "hermes,codex");
  assert.equal(queryString(params), "?sort=requests&harnesses=hermes,codex");
});

test("no keys give an empty query string", () => {
  assert.equal(queryString(new URLSearchParams()), "");
});
