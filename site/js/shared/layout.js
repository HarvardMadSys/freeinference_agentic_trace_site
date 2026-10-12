/**
 * The header and footer every page shares.
 *
 * The header's links carry the URL keys the page gives them, such as the sessions table's filter, sort and page, so
 * moving between pages and back keeps them.
 */

import { selectionQuery } from "./selection.js";

// The header's links: the page's file, the anchor of a section on it ("" for its top), and the link's title.
const PAGES = [
  { file: "index.html", anchor: "", title: "Explore" },
  { file: "index.html", anchor: "#figures-sessions", title: "Sessions" },
  { file: "index.html", anchor: "#figures-tools", title: "Tools" },
  { file: "index.html", anchor: "#figures-caching", title: "Caching" },
  { file: "index.html", anchor: "#figures-comparison", title: "Benchmark" },
  { file: "index.html", anchor: "#sessions", title: "Sessions table" },
  { file: "about.html", anchor: "", title: "About" },
];

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
    <p>From Requests to Sessions: a large-scale characterization of human-driven agentic workloads.</p>
    <p>${links}</p>`;
}

// A link to a section of a page is never marked active: the page's own link is.
function navigationLink(page, activeFile, query) {
  const isSamePage = page.file === activeFile;
  const className = isSamePage && page.anchor === "" ? "nav-link is-active" : "nav-link";
  const href = isSamePage && page.anchor !== "" ? page.anchor : `${page.file}${query}${page.anchor}`;
  return `<a class="${className}" href="${href}">${page.title}</a>`;
}
