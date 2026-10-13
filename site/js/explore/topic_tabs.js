/**
 * The Insights' topic tabs: one row of the six numbered topics under the Insights heading, which shows one topic at a
 * time and hides the others. The shown topic is the URL's hash: a click on a tab writes its topic's anchor as a new
 * entry of the browser's history, Back and Forward show the topic of the entry they return to, and a link with a
 * topic's anchor opens on that topic. On a phone the row scrolls sideways, its right edge faded while more tabs lie
 * beyond it, and keeps the shown tab in it.
 */

import { bringIntoRow, markMoreBeyondEdge } from "../shared/table.js";

// The anchor of the Insights section itself, which, as no anchor does, shows the first topic.
const INSIGHTS_ANCHOR = "insights";

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
 * The anchor of the topic to show for the URL's `hash` (as `location.hash` gives it), among the topics' `anchors` in
 * order: the topic it names; the first for no anchor or the Insights' own; else `current`, the topic shown now, since a
 * link to another section of the page leaves the Insights as they are.
 */
export function topicForHash(hash, anchors, current) {
  const anchor = hash.slice(1);
  if (anchors.includes(anchor)) {
    return anchor;
  }
  if (anchor === "" || anchor === INSIGHTS_ANCHOR) {
    return anchors[0];
  }
  return current;
}

/** A tab for `topic` (as `pageTopics` returns it): a button, "01 Session structure", that controls its section. */
export function topicTab(topic) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.className = "nav-link topic-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", topic.anchor);
  tab.textContent = `${topic.number} ${topic.title}`;
  return tab;
}

/**
 * Show the topic section of `topicSections` whose id is `anchor` and hide the others; mark the tab of `tabs` that
 * controls it as the selected one, and no other.
 */
export function showTopic(topicSections, tabs, anchor) {
  for (const section of topicSections) {
    section.hidden = section.id !== anchor;
  }
  for (const tab of tabs) {
    const isShown = tab.getAttribute("aria-controls") === anchor;
    tab.setAttribute("aria-selected", String(isShown));
    tab.classList.toggle("is-active", isShown);
  }
}

/**
 * Draw the tabs into `row` for the sections `figureSections` name, show the topic the URL's hash names (the first by
 * default), and wire the tabs: a click shows its topic and writes its anchor to the hash, and Back and Forward show the
 * topic of the hash they return to. `onShow()` is called each time a topic is shown, after it is, so that its figures
 * are drawn at their cards' width.
 */
export function mountTopicTabs(row, figureSections, onShow) {
  const topics = pageTopics(figureSections);
  const anchors = topics.map((topic) => topic.anchor);
  const tabs = topics.map(topicTab);
  row.replaceChildren(...tabs);
  const view = { row, tabs, topicSections: anchors.map((anchor) => document.getElementById(anchor)), onShow };
  for (const tab of tabs) {
    tab.addEventListener("click", () => chooseTopic(view, tab.getAttribute("aria-controls")));
  }
  // Back and Forward land on an entry a click wrote, or on the page as it opened; its hash names the topic to show.
  const showHashTopic = () => showTab(view, topicForHash(window.location.hash, anchors, shownTopic(view)));
  window.addEventListener("popstate", showHashTopic);
  window.addEventListener("resize", () => markMoreBeyondEdge(row));
  row.addEventListener("scroll", () => markMoreBeyondEdge(row));
  showTab(view, topicForHash(window.location.hash, anchors, anchors[0]));
}

/** A click on the tab of the topic `anchor`: unless it is shown already, write its anchor to the hash and show it. */
function chooseTopic(view, anchor) {
  if (shownTopic(view) === anchor) {
    return;
  }
  // A new history entry, so that Back returns to the topic shown before; writing it scrolls nothing.
  window.history.pushState(null, "", `#${anchor}`);
  showTab(view, anchor);
}

/** Show the topic `anchor`, bring its tab into the row, and call `view.onShow`. */
function showTab(view, anchor) {
  showTopic(view.topicSections, view.tabs, anchor);
  const shownTab = view.tabs.find((tab) => tab.getAttribute("aria-controls") === anchor);
  bringIntoRow(view.row, shownTab);
  markMoreBeyondEdge(view.row);
  view.onShow();
}

/** The anchor of the topic shown now: the id of the one topic section not hidden. */
function shownTopic(view) {
  return view.topicSections.find((section) => !section.hidden).id;
}
