/**
 * The header and footer every page shares.
 *
 * They link the Explore page's sections. From another page, the links carry the URL keys the page gives them, the
 * sessions table's filter, search, sort and page, so that moving from the table to a session and back by the header
 * keeps them. On the Explore page itself a link is its section's anchor alone, so following it scrolls the page rather
 * than loading it again.
 */

import { selectionQuery } from "./selection.js";

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

/** The Explore page, the landing page, which holds the sections the header and footer link. */
export const EXPLORE_FILE = "index.html";

/** The Explore page's sections, linked from the header and from the footer's "On this site": `{ anchor, title }`. */
export const LINKED_SECTIONS = Object.freeze([
  Object.freeze({ anchor: "#overview", title: "Overview" }),
  Object.freeze({ anchor: "#sessions", title: "Session Explorer" }),
  Object.freeze({ anchor: "#insights", title: "Insights" }),
  Object.freeze({ anchor: "#cite", title: "Cite" }),
]);

// The section whose header link a page marks as current, by the page's file: the Session page is opened from the
// Session Explorer. The Explore page marks none, since all four are on it.
const MARKED_SECTIONS = Object.freeze({ "session.html": "#sessions" });

// The footer's "Elsewhere": the dataset, the paper, the code told apart from the lab's GitHub, then the projects
// around it. The header links nothing off the site; the hero and the footer do.
const ELSEWHERE_LINKS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code (this trace)", url: URLS.code }),
  Object.freeze({ title: "Open Data", url: URLS.openData }),
  Object.freeze({ title: "FreeInference", url: URLS.freeInference }),
  Object.freeze({ title: "MadSys on GitHub", url: URLS.github }),
]);

/** The lab's name, written under the hero and in the footer, linking to the lab. */
export const AFFILIATION = "Harvard SEAS · MadSys Lab";
// The footer's line after its first words, which count the weeks.
const FOOTER_LINE_REST = "worth of coding agent traces from FreeInference.";

/**
 * The words that count `weekCount` weeks, as the hero's lede and the footer's line open: "16 weeks", "1 week";
 * "Weeks" when the count is not known (null), as before `weeks.json` is read or when it cannot be.
 */
export function weekCountText(weekCount) {
  if (weekCount === null) {
    return "Weeks";
  }
  return `${weekCount} ${weekCount === 1 ? "week" : "weeks"}`;
}

/**
 * Fill `container` with the site header: the brand and the links to the Explore page's sections, the one the page
 * was opened from marked.
 * `activeFile` is the page's own file name; `carried` is the URLSearchParams every link to the Explore page carries.
 */
export function renderHeader(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const sectionLinks = LINKED_SECTIONS.map((section) => headerSectionLink(section, activeFile, query));
  container.innerHTML = `
    <div class="header-inner">
      ${brand(query)}
      <nav class="site-nav" aria-label="Site">
        ${sectionLinks.join("")}
      </nav>
    </div>`;
}

// The header containers whose height is already measured, so a redraw of the header adds no second observer.
const MEASURED_HEADERS = new WeakSet();

// The custom property that holds the header's height as drawn, which the sections' scroll margin and the session
// list's sticky header row read (`style.css`): the header takes a second row, and its links wrap, as the width needs.
const HEADER_HEIGHT_PROPERTY = "--header-measured-height";

/**
 * Draw the site header into `container` as `renderHeader` does, and keep the page's `--header-measured-height` at the
 * header's height whenever it changes. A redraw into the same container keeps the measuring.
 */
export function mountHeader(container, activeFile, carried) {
  if (!MEASURED_HEADERS.has(container)) {
    MEASURED_HEADERS.add(container);
    new ResizeObserver(() => measureHeader(container)).observe(container);
  }
  renderHeader(container, activeFile, carried);
}

// Write the header's height, as drawn now, to the page's `--header-measured-height`.
function measureHeader(container) {
  document.documentElement.style.setProperty(HEADER_HEIGHT_PROPERTY, `${container.offsetHeight}px`);
}

/**
 * Fill `container` with the site footer: the brand and one line counting the `weekCount` weeks (null when not known),
 * the Explore page's sections and the places off the site.
 * `activeFile` and `carried` are as `renderHeader` takes them.
 */
export function renderFooter(container, activeFile, carried, weekCount) {
  const query = selectionQuery(carried);
  const sectionLinks = LINKED_SECTIONS.map((section) => footerSectionLink(section, activeFile, query));
  const elsewhereLinks = ELSEWHERE_LINKS.map((link) => externalLink(link, "footer-link"));
  container.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        ${brand(query)}
        <p>${weekCountText(weekCount)} ${FOOTER_LINE_REST}</p>
        <p><a class="affiliation" href="${URLS.lab}" target="_blank" rel="noopener">${AFFILIATION}</a></p>
      </div>
      ${footerLinkList("On this site", sectionLinks)}
      ${footerLinkList("Elsewhere", elsewhereLinks)}
    </div>`;
}

// The brand, linking to the Explore page with the carried keys: a crimson square over a pale one, and the name.
function brand(query) {
  return `
    <a class="brand" href="${EXPLORE_FILE}${query}">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>FreeInference <em>Agentic Dataset</em></span>
    </a>`;
}

// The address of `section` from the page `activeFile`: its anchor alone on the Explore page, else the page, the
// carried keys and the anchor.
function sectionHref(section, activeFile, query) {
  return activeFile === EXPLORE_FILE ? section.anchor : `${EXPLORE_FILE}${query}${section.anchor}`;
}

function headerSectionLink(section, activeFile, query) {
  const href = sectionHref(section, activeFile, query);
  if (MARKED_SECTIONS[activeFile] === section.anchor) {
    // The marked link names where the page was opened from, not the page itself.
    return `<a class="nav-link is-active" href="${href}" aria-current="true">${section.title}</a>`;
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

// A list of the footer's links under its title, which names the nav to a screen reader and is no heading of the page.
function footerLinkList(title, links) {
  return `
    <nav class="footer-nav" aria-label="${title}">
      <p class="footer-nav-title">${title}</p>
      <div class="footer-links">${links.join("")}</div>
    </nav>`;
}
