/**
 * The Explore page's hero: the dataset's name as its title, a lede whose first clause counts the weeks of `weeks.json`
 * and whose rest says what the trace holds, and the buttons to the Insights, the dataset, the paper and the code.
 */

import { URLS } from "../shared/layout.js";

// The numbers under twenty, and the tens, as words.
const ONES = Object.freeze([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
]);
const TENS = Object.freeze(["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);

// The title, the dataset's name: its first phrase, and its second, drawn in the accent.
const TITLE = "FreeInference";
const TITLE_ACCENT = "Agentic Dataset";

// The lede after its first clause, which counts the weeks.
const LEDE_REST = "anonymised: every request, tool call and subagent of the agent sessions FreeInference served.";

// The buttons under the lede: the first leads to the page's Insights, the others leave the site.
const INSIGHTS_BUTTON = Object.freeze({ title: "Insights", href: "#insights" });
const EXTERNAL_BUTTONS = Object.freeze([
  Object.freeze({ title: "Dataset", url: URLS.dataset }),
  Object.freeze({ title: "Paper", url: URLS.paper }),
  Object.freeze({ title: "Code", url: URLS.code }),
]);

/** A whole number from 0 to 99 in words, "sixteen", "twenty-one"; a larger one in digits, "120". */
export function countInWords(count) {
  if (count < ONES.length) {
    return ONES[count];
  }
  if (count >= 100) {
    return String(count);
  }
  const tens = TENS[Math.floor(count / 10)];
  const ones = count % 10;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
}

/**
 * The lede's first clause for `weekCount` weeks: "Sixteen weeks of coding agents,", "One week of coding agents,";
 * "Weeks of coding agents," when the count is not known (null), as when `weeks.json` could not be read.
 */
export function ledeLead(weekCount) {
  if (weekCount === null) {
    return "Weeks of coding agents,";
  }
  const words = countInWords(weekCount);
  const capitalised = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalised} ${weekCount === 1 ? "week" : "weeks"} of coding agents,`;
}

/** Fill `container` with the hero's copy for the `weekCount` weeks the trace holds (null when not known). */
export function renderHero(container, weekCount) {
  const externalButtons = EXTERNAL_BUTTONS.map(
    (button) => `<a class="button" href="${button.url}" target="_blank" rel="noopener">${button.title}</a>`,
  );
  container.innerHTML = `
    <h1 id="hero-title">${TITLE} <em>${TITLE_ACCENT}</em></h1>
    <p class="hero-lede">${ledeLead(weekCount)} ${LEDE_REST}</p>
    <div class="hero-actions">
      <a class="button button--primary" href="${INSIGHTS_BUTTON.href}">${INSIGHTS_BUTTON.title}</a>
      ${externalButtons.join("")}
    </div>`;
}
