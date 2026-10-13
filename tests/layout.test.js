import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { renderFooter, renderHeader, SECTIONS } from "../site/js/shared/layout.js";

// The Overview page, the landing page, which holds the Cite section the header and footer link by anchor.
const OVERVIEW_PAGE = new URL("../site/index.html", import.meta.url);

// The URL keys of the sessions table, as a page gives them to the header and footer.
const TABLE_KEYS = "months=2026-07&harnesses=codex&sort=requests&page=2";

// The markup `render` writes into a stand-in container for the page `activeFile` with the URL keys `query`.
function rendered(render, activeFile, query) {
  const container = { innerHTML: "" };
  render(container, activeFile, new URLSearchParams(query));
  return container.innerHTML;
}

// The header's links to the site's pages and sections as `[title, href, marked]`; a marked link is the current page.
function sectionLinks(activeFile, query) {
  const links = [];
  const markup = rendered(renderHeader, activeFile, query);
  const pattern = /<a class="nav-link( is-active)?" href="([^"]*)"( aria-current="page")?>([^<]*)<\/a>/g;
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
  const list = markup.split(`<h2>${heading}</h2>`)[1].split("</nav>")[0];
  return [...list.matchAll(/>([^<]+)<\/a>/g)].map((match) => match[1]);
}

test("on the Overview page the header links the pages by file and Cite by its anchor alone, Overview marked", () => {
  assert.deepEqual(sectionLinks("index.html", ""), [
    ["Overview", "index.html", true],
    ["Session Explorer", "explorer.html", false],
    ["Insights", "insights.html", false],
    ["Cite", "#cite", false],
  ]);
});

test("on the Session Explorer page its own link is marked and carries the table's keys, and no other link does", () => {
  assert.deepEqual(sectionLinks("explorer.html", TABLE_KEYS), [
    ["Overview", "index.html", false],
    ["Session Explorer", `explorer.html?${TABLE_KEYS}`, true],
    ["Insights", "insights.html", false],
    ["Cite", "index.html#cite", false],
  ]);
});

test("on the Insights page its own link is marked, and Cite leads to the Overview page's Cite section", () => {
  assert.deepEqual(sectionLinks("insights.html", ""), [
    ["Overview", "index.html", false],
    ["Session Explorer", "explorer.html", false],
    ["Insights", "insights.html", true],
    ["Cite", "index.html#cite", false],
  ]);
});

test("on the Session page the Session Explorer link carries the table's keys back, and is marked", () => {
  assert.deepEqual(sectionLinks("session.html", TABLE_KEYS), [
    ["Overview", "index.html", false],
    ["Session Explorer", `explorer.html?${TABLE_KEYS}`, true],
    ["Insights", "insights.html", false],
    ["Cite", "index.html#cite", false],
  ]);
});

test("the brand links the Overview page, without the URL keys", () => {
  const markup = rendered(renderHeader, "session.html", "months=2026-07");
  assert.match(markup, /<a class="brand" href="index\.html">/);
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

test("the footer lists the pages on this site and the places elsewhere", () => {
  assert.deepEqual(footerList("On this site"), ["Overview", "Session Explorer", "Insights", "Cite"]);
  assert.deepEqual(footerList("Elsewhere"), [
    "Dataset", "Paper", "Code (this trace)", "Open Data", "FreeInference", "MadSys on GitHub",
  ]);
});

test("the footer's links lead where the header's do, the Session Explorer link alone with the URL keys", () => {
  const markup = rendered(renderFooter, "session.html", "months=2026-07");
  const links = [...markup.matchAll(/<a class="footer-link" href="([^"]*)">([^<]*)<\/a>/g)];
  assert.deepEqual(links.map((match) => [match[2], match[1]]), [
    ["Overview", "index.html"],
    ["Session Explorer", "explorer.html?months=2026-07"],
    ["Insights", "insights.html"],
    ["Cite", "index.html#cite"],
  ]);
});

test("the footer holds the brand, its line and the two lists of links, and nothing else", () => {
  const markup = rendered(renderFooter, "index.html", "");
  assert.match(markup, /FreeInference <em>Agentic Dataset<\/em>/);
  assert.match(markup, /A trace of agent sessions served by FreeInference\./);
  assert.deepEqual([...markup.matchAll(/<h2>([^<]+)<\/h2>/g)].map((match) => match[1]), ["On this site", "Elsewhere"]);
  assert.doesNotMatch(markup, /Copyright|Accessibility|footer-legal/);
});

test("every page the header and footer link is a page of the site, with its own module and title", () => {
  const titles = {
    "index.html": "FreeInference Agentic Dataset",
    "explorer.html": "Session Explorer · FreeInference Agentic Dataset",
    "insights.html": "Insights · FreeInference Agentic Dataset",
  };
  const modules = { "index.html": "overview.js", "explorer.html": "explorer.js", "insights.html": "insights.js" };
  for (const section of SECTIONS) {
    const page = readFileSync(new URL(`../site/${section.file}`, import.meta.url), "utf8");
    assert.match(page, new RegExp(`<title>${titles[section.file]}</title>`), section.file);
    assert.match(page, new RegExp(`<script type="module" src="js/pages/${modules[section.file]}"></script>`));
    if (section.anchor !== "") {
      assert.match(page, new RegExp(`<section id="${section.anchor.slice(1)}"`), `${section.file} has no ${section.anchor}`);
    }
  }
});

test("the Overview page runs the hero, Overview, Cite and Team, and neither the table nor the figures", () => {
  const page = readFileSync(OVERVIEW_PAGE, "utf8");
  const order = [...page.matchAll(/<section (?:id="([a-z-]+)" )?class="([a-z -]+)"/g)].map((match) => match[1] ?? match[2]);
  assert.deepEqual(order, ["hero", "selection", "overview", "cite", "team"]);
  for (const [id, title] of [["overview", "Overview"], ["cite", "Cite"]]) {
    const start = page.indexOf(`<section id="${id}"`);
    assert.equal(page.slice(start).match(/<h2 id="[^"]+">([^<]+)<\/h2>/)[1], title, id);
  }
  assert.doesNotMatch(page, /sessions-table|card-grid|class="eyebrow"/);
});

test("the Session page's link back reads Session Explorer and opens the Session Explorer page", () => {
  const page = readFileSync(new URL("../site/session.html", import.meta.url), "utf8");
  assert.match(page, /<a id="back-link" href="explorer\.html">← Session Explorer<\/a>/);
});

test("the Session Explorer page holds its heading, the table first under it, and no figure", () => {
  const page = readFileSync(new URL("../site/explorer.html", import.meta.url), "utf8");
  const main = page.slice(page.indexOf("<main"), page.indexOf("</main>"));
  const ids = [...main.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(ids, ["explorer-title", "sessions-table"]);
  assert.match(main, /<h1 id="explorer-title">Session Explorer<\/h1>/);
  assert.doesNotMatch(main, /card-grid|class="eyebrow"/);
  assert.match(page, /<script type="module" src="js\/pages\/explorer\.js"><\/script>/);
});
