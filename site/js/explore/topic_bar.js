/**
 * The Insights page's topic bar: one row, under the site header and as sticky, of the six numbered topics, each
 * linking to its topic's anchor; the topic in view is marked. A topic is in view while its section reaches below the
 * bar, and the first such topic in the page's order is the one marked: the one whose heading last passed the bar. On a
 * phone the row scrolls sideways, its right edge faded while more links lie beyond it, and keeps the marked link in it.
 */

import { bringIntoRow, markMoreBeyondEdge } from "../shared/table.js";
import { noteVisibility } from "./figure_sections.js";

/**
 * The topics of the sections `figureSections` name (entries of `FIGURE_SECTIONS`), read from their headings on the
 * page: `[{ anchor, number, title }]`, the section's id, its number ("01") and its title ("Session structure").
 */
export function pageTopics(figureSections) {
  const topics = [];
  for (const section of figureSections) {
    const element = document.querySelector(section.selector);
    const number = element.querySelector(".topic-number").textContent;
    const title = element.querySelector("h2").textContent.slice(number.length);
    topics.push({ anchor: element.id, number, title });
  }
  return topics;
}

/**
 * The topic bar's row of links for `topics` (as `pageTopics` returns them): "01 Session structure", to `#structure`.
 */
export function topicBarMarkup(topics) {
  const links = [];
  for (const topic of topics) {
    links.push(`<a class="nav-link" href="#${topic.anchor}">${topic.number} ${topic.title}</a>`);
  }
  return `<div class="topic-links">${links.join("")}</div>`;
}

/** The first of `anchors`, in order, that `inView` (a Set of section ids) holds; null when it holds none. */
export function topicInView(anchors, inView) {
  for (const anchor of anchors) {
    if (inView.has(anchor)) {
      return anchor;
    }
  }
  return null;
}

/** Draw the topic bar into `bar` for the sections `figureSections` name, and keep the topic in view marked. */
export function mountTopicBar(bar, figureSections) {
  const topics = pageTopics(figureSections);
  bar.innerHTML = topicBarMarkup(topics);
  const row = bar.querySelector(".topic-links");
  const sections = topics.map((topic) => document.getElementById(topic.anchor));
  const inView = new Set();
  const watcher = { observer: null };
  const onReport = (entries) => noteTopicsInView(row, topics, inView, entries);
  watchBelowBar(bar, sections, watcher, onReport);
  // The bar's place under the header changes with the window's width, and so does what lies below it and the row's.
  window.addEventListener("resize", () => watchBelowBar(bar, sections, watcher, onReport));
  window.addEventListener("resize", () => markMoreBeyondEdge(row));
  row.addEventListener("scroll", () => markMoreBeyondEdge(row));
  markMoreBeyondEdge(row);
}

/**
 * Watch which of `sections` reach below the bar, replacing the watcher's observer of the last call: the observer's
 * root is the window less the header and the bar above its bottom edge.
 */
function watchBelowBar(bar, sections, watcher, onReport) {
  if (watcher.observer !== null) {
    watcher.observer.disconnect();
  }
  const barBottom = parseFloat(getComputedStyle(bar).top) + bar.offsetHeight;
  watcher.observer = new IntersectionObserver(onReport, { rootMargin: `-${barBottom}px 0px 0px 0px` });
  for (const section of sections) {
    watcher.observer.observe(section);
  }
}

/**
 * Keep `inView` current with intersection entries, then mark the link of the topic in view in `row` and keep it in the
 * row.
 */
function noteTopicsInView(row, topics, inView, entries) {
  noteVisibility(inView, entries);
  const current = topicInView(topics.map((topic) => topic.anchor), inView);
  for (const link of row.querySelectorAll(".nav-link")) {
    const isCurrent = link.getAttribute("href") === `#${current}`;
    link.classList.toggle("is-active", isCurrent);
    if (isCurrent) {
      link.setAttribute("aria-current", "location");
      bringIntoRow(row, link);
    } else {
      link.removeAttribute("aria-current");
    }
  }
}
