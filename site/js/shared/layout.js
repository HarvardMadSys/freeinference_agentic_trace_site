/**
 * The header and footer every page shares.
 *
 * The links to the Explore page's sections carry the URL keys the page gives them, such as the sessions table's
 * filter, sort and page, so moving between pages and back keeps them. On the Explore page itself such a link is its
 * anchor alone, so following it scrolls the page rather than loading it again.
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
  accessibility: "https://accessibility.harvard.edu/",
  digitalAccessibility: "https://accessibility.huit.harvard.edu/digital-accessibility-policy",
  copyrightIssue: "https://www.harvard.edu/copyright-issue/",
  infoPractices: "https://hwp.harvard.edu/harvardsites-platform-information-gathering-statement",
});

// The page that holds the sections the header and footer link.
const EXPLORE_FILE = "index.html";

/** The Explore page's sections, linked from the header and from the footer's "On this site". */
export const SECTIONS = Object.freeze([
  Object.freeze({ anchor: "#overview", title: "Overview" }),
  Object.freeze({ anchor: "#figures", title: "Figures" }),
  Object.freeze({ anchor: "#sessions", title: "Sessions" }),
  Object.freeze({ anchor: "#cite", title: "Cite" }),
]);

// The section whose header link a page marks as current, by the page's file: the Session page is opened from the
// session list. The Explore page marks none, since all four are on it.
const MARKED_SECTIONS = Object.freeze({ "session.html": "#sessions" });

// The places off the site the header links, after its sections.
const EXTERNAL_LINKS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code", url: URLS.code }),
  Object.freeze({ title: "Open Data", url: URLS.openData }),
]);

// The footer's "Elsewhere": the header's places off the site, then the projects around it.
const ELSEWHERE_LINKS = Object.freeze([
  ...EXTERNAL_LINKS,
  Object.freeze({ title: "FreeInference", url: URLS.freeInference }),
  Object.freeze({ title: "GitHub", url: URLS.github }),
]);

// Harvard's policies, which every page of a Harvard site links.
const POLICY_LINKS = Object.freeze([
  Object.freeze({ title: "Accessibility", url: URLS.accessibility }),
  Object.freeze({ title: "Digital Accessibility", url: URLS.digitalAccessibility }),
  Object.freeze({ title: "Report Copyright Infringement", url: URLS.copyrightIssue }),
  Object.freeze({ title: "Info Practices", url: URLS.infoPractices }),
]);

const AFFILIATION = "Harvard SEAS · MadSys Lab";
const FOOTER_LINE = "The FreeInference agentic trace, from Harvard MadSys and collaborators.";
const COPYRIGHT = "Copyright © 2026 The President and Fellows of Harvard College";

/**
 * Fill `container` with the site header: the brand, the affiliation, the links to the Explore page's sections and the
 * links off the site.
 * `activeFile` is the page's own file name; `carried` is the URLSearchParams every link to the Explore page carries.
 */
export function renderHeader(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const sectionLinks = SECTIONS.map((section) => headerSectionLink(section, activeFile, query));
  const externalLinks = EXTERNAL_LINKS.map((link) => externalLink(link, "nav-link"));
  container.innerHTML = `
    <div class="header-inner">
      ${brand(query)}
      <a class="affiliation" href="${URLS.lab}" target="_blank" rel="noopener">${AFFILIATION}</a>
      <nav class="site-nav" aria-label="Site">
        ${sectionLinks.join("")}
        <span class="nav-divider" aria-hidden="true"></span>
        ${externalLinks.join("")}
      </nav>
    </div>`;
}

/**
 * Fill `container` with the site footer: the brand and one line, the Explore page's sections, the places off the
 * site, and Harvard's copyright and policies.
 * `activeFile` and `carried` are as `renderHeader` takes them.
 */
export function renderFooter(container, activeFile, carried) {
  const query = selectionQuery(carried);
  const sectionLinks = SECTIONS.map((section) => footerSectionLink(section, activeFile, query));
  const elsewhereLinks = ELSEWHERE_LINKS.map((link) => externalLink(link, "footer-link"));
  const policyLinks = POLICY_LINKS.map((link) => externalLink(link, "footer-link"));
  container.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        ${brand(query)}
        <p>${FOOTER_LINE}</p>
      </div>
      ${footerLinkList("On this site", sectionLinks)}
      ${footerLinkList("Elsewhere", elsewhereLinks)}
    </div>
    <div class="footer-legal">
      <p>${COPYRIGHT}</p>
      <nav aria-label="Harvard policies">${policyLinks.join("")}</nav>
    </div>`;
}

// The brand, linking to the Explore page with the carried keys: a crimson square over a pale one, and the name.
function brand(query) {
  return `
    <a class="brand" href="${EXPLORE_FILE}${query}">
      <span class="brand-mark" aria-hidden="true"></span>
      <span>FreeInference <em>agentic trace</em></span>
    </a>`;
}

// The address of `section` from the page `activeFile`: its anchor alone on the Explore page, else the page, the
// carried keys and the anchor.
function sectionHref(section, activeFile, query) {
  return activeFile === EXPLORE_FILE ? section.anchor : `${EXPLORE_FILE}${query}${section.anchor}`;
}

function headerSectionLink(section, activeFile, query) {
  const isMarked = MARKED_SECTIONS[activeFile] === section.anchor;
  const className = isMarked ? "nav-link is-active" : "nav-link";
  return `<a class="${className}" href="${sectionHref(section, activeFile, query)}">${section.title}</a>`;
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
