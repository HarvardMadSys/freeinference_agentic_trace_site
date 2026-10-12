import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderFooter, renderHeader, SECTIONS } from "../site/js/shared/layout.js";

// The Explore page, whose sections the header and footer link by anchor.
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
    ["Figures", "#figures", false],
    ["Sessions", "#sessions", false],
    ["Cite", "#cite", false],
  ]);
});

test("on the Session page the header's section links carry the URL keys, and Sessions is marked", () => {
  assert.deepEqual(sectionLinks("session.html", "months=2026-07&harnesses=codex&sort=requests&page=2"), [
    ["Overview", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#overview", false],
    ["Figures", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#figures", false],
    ["Sessions", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#sessions", true],
    ["Cite", "index.html?months=2026-07&harnesses=codex&sort=requests&page=2#cite", false],
  ]);
});

test("the brand links the Explore page with the URL keys", () => {
  const markup = rendered(renderHeader, "session.html", "months=2026-07");
  assert.match(markup, /<a class="brand" href="index\.html\?months=2026-07">/);
  assert.match(markup, /FreeInference <em>agentic trace<\/em>/);
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
  assert.deepEqual(footerList("On this site"), ["Overview", "Figures", "Sessions", "Cite"]);
  assert.deepEqual(footerList("Elsewhere"), ["Dataset", "Paper", "Code", "Open Data", "FreeInference", "GitHub"]);
});

test("the footer's section links carry the URL keys from the Session page", () => {
  const markup = rendered(renderFooter, "session.html", "months=2026-07");
  assert.match(markup, /<a class="footer-link" href="index\.html\?months=2026-07#sessions">Sessions<\/a>/);
});

test("the footer holds the brand line, Harvard's copyright and its four policies", () => {
  const markup = rendered(renderFooter, "index.html", "");
  assert.match(markup, /The FreeInference agentic trace, from Harvard MadSys and collaborators\./);
  assert.match(markup, /Copyright © 2026 The President and Fellows of Harvard College/);
  const policies = externalLinks(markup.split('aria-label="Harvard policies"')[1]);
  assert.deepEqual(policies, [
    ["Accessibility", "https://accessibility.harvard.edu/"],
    ["Digital Accessibility", "https://accessibility.huit.harvard.edu/digital-accessibility-policy"],
    ["Report Copyright Infringement", "https://www.harvard.edu/copyright-issue/"],
    ["Info Practices", "https://hwp.harvard.edu/harvardsites-platform-information-gathering-statement"],
  ]);
});

test("every section the header and footer link is an element of the Explore page", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  for (const section of SECTIONS) {
    assert.match(page, new RegExp(`<section id="${section.anchor.slice(1)}"`), `index.html has no section ${section.anchor}`);
  }
});
