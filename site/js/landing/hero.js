/**
 * The Explore page's hero: the dataset's name as its title, a lede whose first words count the weeks of `weeks.json`
 * and whose rest says what the trace holds, the buttons to the page's Session Explorer and Insights, the dataset, the
 * paper and the code, and the lab's name under them.
 */

import { AFFILIATION, URLS } from "../shared/layout.js";

// The title, the dataset's name: its first phrase, and its second, drawn in the accent.
const TITLE = "FreeInference";
const TITLE_ACCENT = "Agentic Dataset";

// The lede after its first words, which count the weeks.
const LEDE_REST = "worth of production agent traces from FreeInference across diverse agent harnesses, with latency, "
  + "tool, and KV block information.";

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

/**
 * The lede's first words for `weekCount` weeks: "16 weeks", "1 week"; "Weeks" when the count is not known (null), as
 * when `weeks.json` could not be read.
 */
export function ledeOpening(weekCount) {
  if (weekCount === null) {
    return "Weeks";
  }
  return `${weekCount} ${weekCount === 1 ? "week" : "weeks"}`;
}

/** Fill `container` with the hero's copy for the `weekCount` weeks the trace holds (null when not known). */
export function renderHero(container, weekCount) {
  const siteButtons = SITE_BUTTONS.map(
    (button) => `<a class="${button.className}" href="${button.href}">${button.title}</a>`,
  );
  const externalButtons = EXTERNAL_BUTTONS.map(
    (button) => `<a class="button" href="${button.url}" target="_blank" rel="noopener">${button.title}</a>`,
  );
  container.innerHTML = `
    <h1 id="hero-title">${TITLE} <em>${TITLE_ACCENT}</em></h1>
    <p class="hero-lede">${ledeOpening(weekCount)} ${LEDE_REST}</p>
    <div class="hero-actions">
      ${siteButtons.join("")}
      ${externalButtons.join("")}
    </div>
    <p class="hero-affiliation"><a class="affiliation" href="${URLS.lab}" target="_blank" rel="noopener">${AFFILIATION}</a></p>`;
}
