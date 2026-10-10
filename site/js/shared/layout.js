/**
 * The header and footer every page shares.
 *
 * The header's links carry the current selection, so moving between pages
 * keeps the chosen weeks and scope.
 */

import { selectionQuery } from "./selection.js";

const PAGES = [
  { file: "index.html", title: "Explore" },
  { file: "figures.html", title: "Paper figures" },
  { file: "about.html", title: "About" },
];

const EXTERNAL_LINKS = [
  { title: "Dataset", url: "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace" },
  { title: "Pipeline", url: "https://github.com/HarvardMadSys/freeinference_agentic_trace" },
];

/**
 * Fill `container` with the site header.
 * `activeFile` is the page's own file name; `selection` is the URLSearchParams every link carries.
 */
export function renderHeader(container, activeFile, selection) {
  const query = selectionQuery(selection);
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

function navigationLink(page, activeFile, query) {
  const className = page.file === activeFile ? "nav-link is-active" : "nav-link";
  return `<a class="${className}" href="${page.file}${query}">${page.title}</a>`;
}
