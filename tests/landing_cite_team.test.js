import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { copySource, mountCopyButtons } from "../site/js/landing/cite.js";
import { renderTeam } from "../site/js/landing/team.js";

// The Explore page, which holds the BibTeX block.
const EXPLORE_PAGE = new URL("../site/index.html", import.meta.url);

// A stand-in clipboard that keeps what it was given.
function fakeClipboard() {
  return { written: [], async writeText(text) { this.written.push(text); } };
}

// A stand-in page of one copy button, `data-copy="bibtex"`, and the block it copies, holding `text`.
function fakePage(text) {
  const listeners = [];
  const button = { hidden: true, textContent: "Copy", dataset: { copy: "bibtex" },
    addEventListener: (type, listener) => listeners.push(listener) };
  const source = { textContent: text };
  const root = { querySelectorAll: () => [button], getElementById: (id) => (id === "bibtex" ? source : null) };
  return { root, button, source, listeners };
}

test("the BibTeX block on the page is the paper's citation", () => {
  const page = readFileSync(EXPLORE_PAGE, "utf8");
  assert.match(page, /<pre id="bibtex"><code>@article\{freeinference2026requests,/);
  assert.match(page, /author = \{Nixon, William and Tian, Muxin and Zheng, Yunjia\s+and Gunawi, Haryadi S\. and Yang, Juncheng\}/);
  assert.match(page, /<button class="cite-copy" type="button" data-copy="bibtex" hidden>Copy<\/button>/);
});

test("with no clipboard the copy button stays hidden", () => {
  const page = fakePage("@article{x}");
  mountCopyButtons(page.root, undefined);
  assert.equal(page.button.hidden, true);
  assert.equal(page.listeners.length, 0);
});

test("with a clipboard the button shows, and a click puts the block's text on it unchanged", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const page = fakePage("\n@article{x,\n  year = {2026}\n}\n");
  const clipboard = fakeClipboard();
  mountCopyButtons(page.root, clipboard);
  assert.equal(page.button.hidden, false);
  await page.listeners[0]();
  assert.deepEqual(clipboard.written, ["@article{x,\n  year = {2026}\n}"]);
  assert.equal(page.button.textContent, "Copied");
  context.mock.timers.tick(2000);
  assert.equal(page.button.textContent, "Copy");
});

test("a clipboard that refuses says so on the button", async (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  context.mock.method(console, "error", () => undefined);
  const button = { textContent: "Copy" };
  await copySource(button, { textContent: "x" }, { writeText: async () => { throw new Error("denied"); } });
  assert.equal(button.textContent, "Select and copy");
});

test("the team lists the five authors in the paper's order, with their affiliations", () => {
  const container = { innerHTML: "" };
  renderTeam(container);
  const authors = [...container.innerHTML.matchAll(/<strong>([^<]+)<\/strong>(?:<\/a>)?<span>([^<]+)<\/span>/g)];
  assert.deepEqual(authors.map((match) => [match[1], match[2]]), [
    ["William Nixon", "University of Chicago & Harvard University"],
    ["Muxin Tian", "University of Toronto"],
    ["Yunjia Zheng", "Harvard University"],
    ["Haryadi S. Gunawi", "University of Chicago"],
    ["Juncheng Yang", "Harvard University"],
  ]);
});

test("the About paragraph links the dataset, the code, Open Data and FreeInference", () => {
  const container = { innerHTML: "" };
  renderTeam(container);
  const about = container.innerHTML.split('class="arrow-links"')[1];
  const links = [...about.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(links, [
    "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace",
    "https://github.com/HarvardMadSys/freeinference_agentic_trace",
    "https://data.freeinference.org/",
    "https://freeinference.org/",
  ]);
});
