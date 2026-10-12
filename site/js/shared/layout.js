/**
 * The header and footer every page shares.
 *
 * The header's links carry the URL keys the page gives them, such as the sessions table's filter, sort and page, so
 * moving between pages and back keeps them. A page without a link of its own marks the page it is reached from.
 */

import { selectionQuery } from "./selection.js";

// The header's links: the page's file, the anchor of a section on it ("" for its top), and the link's title.
const PAGES = [
  { file: "index.html", anchor: "", title: "Explore" },
  { file: "index.html", anchor: "#figures-sessions", title: "Sessions" },
  { file: "index.html", anchor: "#figures-tools", title: "Tools" },
  { file: "index.html", anchor: "#figures-caching", title: "Prefix caching" },
  { file: "index.html", anchor: "#figures-comparison", title: "Benchmark" },
  { file: "index.html", anchor: "#sessions", title: "Session list" },
  { file: "about.html", anchor: "", title: "About" },
];

// The page whose link a page without one of its own marks as current: the Session page is opened from Explore.
const MARKED_PAGES = Object.freeze({ "session.html": "index.html" });

// The paper, cited on the dataset card, whose title the footer links.
const PAPER = Object.freeze({
  title: "From Requests to Sessions: A Large-Scale Characterization of Human-Driven Agentic Workloads",
  url: "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace#citation",
});

const EXTERNAL_LINKS = [
  { title: "Dataset", url: "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace" },
  { title: "Pipeline", url: "https://github.com/HarvardMadSys/freeinference_agentic_trace" },
];

/**
 * Fill `container` with the site header.
 * `activeFile` is the page's own file name; `carried` is the URLSearchParams every link carries. A link to a section
 * of the page itself is its anchor alone, so following it scrolls the page rather than loading it again.
 */
export function renderHeader(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const links = PAGES.map((page) => navigationLink(page, activeFile, query)).join("");
  container.innerHTML = `
    <div class="header-inner">
      <a class="brand" href="index.html${query}">FreeInference <span class="brand-muted">agentic trace</span></a>
      <nav class="site-nav">${links}</nav>
    </div>`;
}

/** Fill `container` with the site footer. */
export function renderFooter(container) {
  const links = EXTERNAL_LINKS.map((link) => `<a href="${link.url}">${link.title}</a>`).join(" · ");
  container.innerHTML = `
    <p><a href="${PAPER.url}">${PAPER.title}</a></p>
    <p>${links}</p>`;
}

// A link to a section of a page is never marked active: the page's own link is, or the link of the page it is
// reached from.
function navigationLink(page, activeFile, query) {
  const isSamePage = page.file === activeFile;
  const markedFile = MARKED_PAGES[activeFile] ?? activeFile;
  const className = page.file === markedFile && page.anchor === "" ? "nav-link is-active" : "nav-link";
  const href = isSamePage && page.anchor !== "" ? page.anchor : `${page.file}${query}${page.anchor}`;
  return `<a class="${className}" href="${href}">${page.title}</a>`;
}
