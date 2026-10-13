/**
 * The Explore page's hero: the dataset's name as its title, a lede saying what the trace holds and what it is for,
 * and the buttons to the page's Session Explorer and Insights, the dataset, the paper and the code.
 */

import { URLS } from "../shared/layout.js";

// The title, the dataset's name: its first phrase, and its second, drawn in the accent.
const TITLE = "FreeInference";
const TITLE_ACCENT = "Agentic Dataset";

// The lede: what the trace is, what it holds, what it is for.
const LEDE = "Production agent traces from FreeInference across 13 diverse agent harnesses, covering prefix-block hashes, "
  + "request timing, and sessions for studying KV-cache reuse and agent serving.";

// The buttons under the lede: the first two scroll to the page's own sections, the first of them the primary one; the
// others leave the site.
const SITE_BUTTONS = Object.freeze([
  Object.freeze({ title: "Session Explorer", href: "#sessions", className: "button button--primary" }),
  Object.freeze({ title: "Insights", href: "#insights", className: "button" }),
]);
const EXTERNAL_BUTTONS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code", url: URLS.code }),
]);

/** Fill `container` with the hero's copy: the title, the lede and the five buttons. */
export function renderHero(container) {
  const siteButtons = SITE_BUTTONS.map(
    (button) => `<a class="${button.className}" href="${button.href}">${button.title}</a>`,
  );
  const externalButtons = EXTERNAL_BUTTONS.map(
    (button) => `<a class="button" href="${button.url}" target="_blank" rel="noopener">${button.title}</a>`,
  );
  container.innerHTML = `
    <h1 id="hero-title">${TITLE} <em>${TITLE_ACCENT}</em></h1>
    <p class="hero-lede">${LEDE}</p>
    <div class="hero-actions">
      ${siteButtons.join("")}
      ${externalButtons.join("")}
    </div>`;
}
