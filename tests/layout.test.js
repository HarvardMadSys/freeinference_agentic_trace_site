import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { oldLinkAddress } from "../site/js/landing/old_links.js";
import { renderFooter, renderHeader, SECTIONS } from "../site/js/shared/layout.js";

// The Overview page, whose sections the header and footer link by anchor.
const EXPLORE_PAGE = new URL("../site/index.html", import.meta.url);

// The markup `render` writes into a stand-in container for the page `activeFile` with the URL keys `query`.
function rendered(render, activeFile, query) {
  const container = { innerHTML: "" };
  render(container, activeFile, new URLSearchParams(query));
  return container.innerHTML;
}

// The header's links to the Explore page's sections as `[title, href, active]`.
function sectionLinks(activeFile, query) {
  const links = [];
  const markup = rendered(renderHeader, activeFile, query);
  for (const match of markup.matchAll(/<a class="nav-link( is-active)?" href="([^"]*)">([^<]*)<\/a>/g)) {
    links.push([match[3], match[2], match[1] !== undefined]);
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
  const list = markup.split(`<h2>${heading}</h2>`)[1].split("</nav>")[0];
  return [...list.matchAll(/>([^<]+)<\/a>/g)].map((match) => match[1]);
}

test("on the Explore page the header links its four sections by anchor alone, none marked", () => {
  assert.deepEqual(sectionLinks("index.html", "months=2026-07&harnesses=codex&sort=requests&page=2"), [
    ["Overview", "#overview", false],
    ["Session Explorer", "#sessions", false],
    ["Insights", "#insights", false],
    ["Cite", "#cite", false],
  ]);
});

test("on the Session page the header's section links carry the URL keys, and Session Explorer is marked", () => {
  assert.deepEqual(sectionLinks("session.html", "months=2026-07&harnesses=codex&sort=requests&page=2"), [
    ["Overview", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#overview", false],
    ["Session Explorer", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#sessions", true],
    ["Insights", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#insights", false],
    ["Cite", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#cite", false],
  ]);
});

test("the brand links the Explore page with the URL keys", () => {
  const markup = rendered(renderHeader, "session.html", "months=2026-07");
  assert.match(markup, /<a class="brand" href="index\.html\?months=2026-07">/);
  assert.match(markup, /FreeInference <em>Agentic Dataset<\/em>/);
});

test("the header links the lab and the four places off the site, each in a new tab", () => {
  assert.deepEqual(externalLinks(rendered(renderHeader, "index.html", "")), [
    ["Harvard SEAS · MadSys Lab", "https://madsys.seas.harvard.edu/"],
    ["Dataset", "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace"],
    ["Paper", "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf"],
    ["Code", "https://github.com/HarvardMadSys/freeinference_agentic_trace"],
    ["Open Data", "https://data.freeinference.org/"],
  ]);
});

test("the header links no About page", () => {
  assert.doesNotMatch(rendered(renderHeader, "index.html", ""), /about\.html|>About</);
});

test("the footer lists the sections on this site and the places elsewhere", () => {
  assert.deepEqual(footerList("On this site"), ["Overview", "Session Explorer", "Insights", "Cite"]);
  assert.deepEqual(footerList("Elsewhere"), [
    "Dataset", "Paper", "Code (this trace)", "Open Data", "FreeInference", "MadSys on GitHub",
  ]);
});

test("the footer's section links carry the URL keys from the Session page", () => {
  const markup = rendered(renderFooter, "session.html", "months=2026-07");
  assert.match(markup, /<a class="footer-link" href="index\.html\?months=2026-07#sessions">Session Explorer<\/a>/);
});

test("the footer holds the brand, its line and the two lists of links, and nothing else", () => {
  const markup = rendered(renderFooter, "index.html", "");
  assert.match(markup, /FreeInference <em>Agentic Dataset<\/em>/);
  assert.match(markup, /A trace of agent sessions served by FreeInference\./);
  assert.deepEqual([...markup.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]), ["On this site", "Elsewhere"]);
  assert.doesNotMatch(markup, /Copyright|Accessibility|footer-legal/);
});

test("every section the header and footer link is an element of the Overview page or one it sends on", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  for (const section of SECTIONS) {
    const isOnPage = page.includes(`<section id="${section.anchor.slice(1)}"`);
    assert.ok(isOnPage || oldLinkAddress(section.anchor, "") !== null, `index.html has no section ${section.anchor}`);
  }
});

test("the Overview page runs Overview, Cite and Team, each of the three a heading alone", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  const order = [...page.matchAll(/<section id="(overview|sessions|insights|cite|team)"/g)].map((match) => match[1]);
  assert.deepEqual(order, ["overview", "cite", "team"]);
  for (const id of ["overview", "cite"]) {
    const start = page.indexOf(`<section id="${id}"`);
    const firstHeading = page.slice(start).match(/<h2 id="[^"]+">([^<]+)<\/h2>/)[1];
    assert.equal(firstHeading, SECTIONS.find((section) => section.anchor === `#${id}`).title, id);
  }
  assert.doesNotMatch(page, /class="eyebrow"/);
});

test("the Session page's link back reads Session Explorer and opens the Explore page at it", () => {
  const page = readFileSync(new URL("../site/session.html", import.meta.url), "utf8");
  assert.match(page, /<a id="back-link" href="index\.html#sessions">← Session Explorer<\/a>/);
});
