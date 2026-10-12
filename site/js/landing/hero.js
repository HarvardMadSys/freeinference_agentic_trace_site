/**
 * The Explore page's hero: an eyebrow naming the dataset, a title of two phrases whose first counts the weeks of
 * `weeks.json`, one sentence on what the trace holds, and the buttons to the figures, the dataset, the paper and the
 * code.
 */

import { URLS } from "../shared/layout.js";

// The numbers under twenty, and the tens, as words.
const ONES = Object.freeze([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen",
]);
const TENS = Object.freeze(["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);

// The title's second phrase, drawn in the accent.
const TITLE_ACCENT = "request by request.";

const LEDE = "An anonymised trace of the agent sessions FreeInference served: every request, tool call and subagent, "
  + "with the paper's figures drawn over it.";

// The buttons under the lede: the first leads to the page's figures, the others leave the site.
const FIGURES_BUTTON = Object.freeze({ title: "See the figures", href: "#figures" });
const EXTERNAL_BUTTONS = Object.freeze([
  Object.freeze({ title: "Hugging Face dataset", url: URLS.dataset }),
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
 * The title's first phrase for `weekCount` weeks: "Sixteen weeks of coding agents,", "One week of coding agents,";
 * "Weeks of coding agents," when the count is not known (null), as when `weeks.json` could not be read.
 */
export function titleLead(weekCount) {
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
    <p class="eyebrow"><span class="eyebrow-mark" aria-hidden="true"></span>FreeInference agentic trace</p>
    <h1 id="hero-title">${titleLead(weekCount)} <br><em>${TITLE_ACCENT}</em></h1>
    <p class="hero-lede">${LEDE}</p>
    <div class="hero-actions">
      <a class="button button--primary" href="${FIGURES_BUTTON.href}">${FIGURES_BUTTON.title}</a>
      ${externalButtons.join("")}
    </div>`;
}
