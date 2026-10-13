/**
 * The header and footer every page shares.
 *
 * They link the three Explore pages and the Overview page's Cite section. The Session Explorer link carries the URL
 * keys the page gives it, the sessions table's filter, search, sort and page, so that moving from the table to a
 * session and back by the header keeps them; no other link carries a key. On its own page a link to a section is its
 * anchor alone, so following it scrolls the page rather than loading it again.
 */

import { selectionQuery } from "./selection.js";
import { bringIntoRow, markMoreBeyondEdge } from "./table.js";

/** Every address outside the site that a page links, each written once. */
export const URLS = Object.freeze({
  lab: "https://madsys.seas.harvard.edu/",
  dataset: "https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace",
  paper: "https://data.freeinference.org/pdf/paper/from-requests-to-sessions.pdf",
  code: "https://github.com/HarvardMadSys/freeinference_agentic_trace",
  openData: "https://data.freeinference.org/",
  freeInference: "https://freeinference.org/",
  github: "https://github.com/HarvardMadSys",
});

// The Overview page, the landing page, which the brand links.
const OVERVIEW_FILE = "index.html";

// The Session Explorer page, whose link alone carries the URL keys: they are its table's.
const EXPLORER_FILE = "explorer.html";

/**
 * The site's links, in the header and in the footer's "On this site": each `{ file, anchor, title }`, a page's file and
 * no anchor, or a section's page and its anchor.
 */
export const SECTIONS = Object.freeze([
  Object.freeze({ file: OVERVIEW_FILE, anchor: "", title: "Overview" }),
  Object.freeze({ file: EXPLORER_FILE, anchor: "", title: "Session Explorer" }),
  Object.freeze({ file: "insights.html", anchor: "", title: "Insights" }),
  Object.freeze({ file: OVERVIEW_FILE, anchor: "#cite", title: "Cite" }),
]);

// The page whose header link a page marks as current, by the page's file, where that is not the page itself: the
// Session page is opened from the Session Explorer.
const MARKED_PAGES = Object.freeze({ "session.html": EXPLORER_FILE });

// The places off the site the header links, after its sections.
const EXTERNAL_LINKS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code", url: URLS.code }),
  Object.freeze({ title: "Open Data", url: URLS.openData }),
]);

// The footer's "Elsewhere": the header's places off the site, the code told apart from the lab's GitHub, then the
// projects around it.
const ELSEWHERE_LINKS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code (this trace)", url: URLS.code }),
  Object.freeze({ title: "Open Data", url: URLS.openData }),
  Object.freeze({ title: "FreeInference", url: URLS.freeInference }),
  Object.freeze({ title: "MadSys on GitHub", url: URLS.github }),
]);

const AFFILIATION = "Harvard SEAS · MadSys Lab";
const FOOTER_LINE = "A trace of agent sessions served by FreeInference.";

/**
 * Fill `container` with the site header: the brand, the affiliation, the links to the site's pages and sections, the
 * current page's marked, and the links off the site.
 * `activeFile` is the page's own file name; `carried` is the URLSearchParams the Session Explorer link carries.
 */
export function renderHeader(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const sectionLinks = SECTIONS.map((section) => headerSectionLink(section, activeFile, query));
  // The links off the site are left out at phone width, where the hero and the footer carry them.
  const externalLinks = EXTERNAL_LINKS.map((link) => externalLink(link, "nav-link is-external"));
  container.innerHTML = `
    <div class="header-inner">
      ${brand()}
      <a class="affiliation" href="${URLS.lab}" target="_blank" rel="noopener">${AFFILIATION}</a>
      <nav class="site-nav" aria-label="Site">
        ${sectionLinks.join("")}
        <span class="nav-divider" aria-hidden="true"></span>
        ${externalLinks.join("")}
      </nav>
    </div>`;
}

// The header containers whose links row is already wired, so a redraw of the header adds no second listener.
const WIRED_HEADERS = new WeakSet();

/**
 * Draw the site header into `container` as `renderHeader` does, and wire its links: on a phone they scroll sideways in
 * one row, whose right edge fades while more links lie beyond it, scrolled so that the current page's link is in it. A
 * redraw into the same container keeps the wiring.
 */
export function mountHeader(container, activeFile, carried) {
  if (!WIRED_HEADERS.has(container)) {
    WIRED_HEADERS.add(container);
    // A scroll does not bubble, so the container hears the row's in the capture phase.
    container.addEventListener("scroll", (event) => markMoreBeyondEdge(event.target), true);
    new ResizeObserver(() => markMoreBeyondEdge(container.querySelector(".site-nav"))).observe(container);
  }
  renderHeader(container, activeFile, carried);
  const links = container.querySelector(".site-nav");
  const marked = links.querySelector(".nav-link.is-active");
  if (marked !== null) {
    bringIntoRow(links, marked);
  }
  markMoreBeyondEdge(links);
}

/**
 * Fill `container` with the site footer: the brand and one line, the site's pages and sections and the places off the
 * site.
 * `activeFile` and `carried` are as `renderHeader` takes them.
 */
export function renderFooter(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const sectionLinks = SECTIONS.map((section) => footerSectionLink(section, activeFile, query));
  const elsewhereLinks = ELSEWHERE_LINKS.map((link) => externalLink(link, "footer-link"));
  container.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        ${brand()}
        <p>${FOOTER_LINE}</p>
      </div>
      ${footerLinkList("On this site", sectionLinks)}
      ${footerLinkList("Elsewhere", elsewhereLinks)}
    </div>`;
}

// The brand, linking to the Overview page: a crimson square over a pale one, and the name.
function brand() {
  return `
    <a class="brand" href="${OVERVIEW_FILE}">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>FreeInference <em>Agentic Dataset</em></span>
    </a>`;
}

/**
 * The address of `section` from the page `activeFile`: a section's anchor alone on its own page; else its file, the
 * carried keys `query` for the Session Explorer page alone, and its anchor.
 */
function sectionHref(section, activeFile, query) {
  if (section.anchor !== "" && section.file === activeFile) {
    return section.anchor;
  }
  const carried = section.file === EXPLORER_FILE ? query : "";
  return `${section.file}${carried}${section.anchor}`;
}

/** Whether the header marks the link `section` on the page `activeFile`: a page's own link, never a section's. */
function isMarkedLink(section, activeFile) {
  const markedFile = MARKED_PAGES[activeFile] ?? activeFile;
  return section.anchor === "" && section.file === markedFile;
}

function headerSectionLink(section, activeFile, query) {
  const href = sectionHref(section, activeFile, query);
  if (isMarkedLink(section, activeFile)) {
    return `<a class="nav-link is-active" href="${href}" aria-current="page">${section.title}</a>`;
  }
  return `<a class="nav-link" href="${href}">${section.title}</a>`;
}

function footerSectionLink(section, activeFile, query) {
  return `<a class="footer-link" href="${sectionHref(section, activeFile, query)}">${section.title}</a>`;
}

// A link off the site opens in a new tab, without giving that tab a handle on this one.
function externalLink(link, className) {
  return `<a class="${className}" href="${link.url}" target="_blank" rel="noopener">${link.title}</a>`;
}

function footerLinkList(heading, links) {
  return `
    <nav class="footer-nav" aria-label="${heading}">
      <h2>${heading}</h2>
      <div class="footer-links">${links.join("")}</div>
    </nav>`;
}
