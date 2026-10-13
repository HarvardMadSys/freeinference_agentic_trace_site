/**
 * The Insights' topic tabs: one row of the six numbered topics under the Insights heading, which shows one topic at a
 * time and hides the others. The row follows the ARIA tabs pattern: one tab stop, the shown tab; the arrow keys, Home
 * and End move to another tab and show its topic; each topic section is a tab panel labelled by its tab.
 *
 * The shown topic is kept in the browser's history: the entry the page opened on holds its topic, a tab chosen writes
 * its topic's anchor as a new entry, and Back and Forward show the topic of the entry they return to, whatever anchor
 * the page opened on. A link with a topic's anchor opens on that topic. On a phone the row scrolls sideways and keeps
 * the shown tab in it.
 */

import { bringIntoRow, markMoreBeyondEdge, mountScrollingRow } from "../shared/table.js";

// The anchor of the Insights section itself, which, as no anchor does, shows the first topic.
const INSIGHTS_ANCHOR = "insights";

// The prefix of a tab's id, before its topic's anchor: the tab of `#insights-tokens` is `#tab-insights-tokens`.
const TAB_ID_PREFIX = "tab-";

/**
 * The topics of the sections `figureSections` name (entries of `FIGURE_SECTIONS`), read from their headings on the
 * page: `[{ anchor, number, title }]`, the section's id, its number ("01") and its title ("Session structure").
 */
function pageTopics(figureSections) {
  const topics = [];
  for (const section of figureSections) {
    const element = document.querySelector(section.selector);
    const heading = element.querySelector("h2");
    const number = heading.querySelector(".topic-number").textContent;
    // The heading is the number's element, a space and the title, its last text node.
    const title = heading.lastChild.textContent.trim();
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

/**
 * The anchor of the topic to show on returning to a history entry: the topic its `state` holds, as the tabs wrote it,
 * else the one its `hash` names (`topicForHash`), for an entry the tabs did not write.
 */
export function topicForEntry(state, hash, anchors, current) {
  if (state !== null && typeof state === "object" && anchors.includes(state.topic)) {
    return state.topic;
  }
  return topicForHash(hash, anchors, current);
}

/**
 * The index of the tab a key moves to from the tab at `index` of `count`: ArrowRight the next and ArrowLeft the one
 * before, each wrapping round, Home the first and End the last; null for any other key.
 */
export function tabIndexForKey(key, index, count) {
  if (key === "ArrowRight") {
    return (index + 1) % count;
  }
  if (key === "ArrowLeft") {
    return (index - 1 + count) % count;
  }
  if (key === "Home") {
    return 0;
  }
  if (key === "End") {
    return count - 1;
  }
  return null;
}

/** A tab for `topic` (as `pageTopics` returns it): a button, "01 Session structure", that controls its section. */
export function topicTab(topic) {
  const tab = document.createElement("button");
  tab.type = "button";
  tab.id = `${TAB_ID_PREFIX}${topic.anchor}`;
  tab.className = "nav-link topic-tab";
  tab.setAttribute("role", "tab");
  tab.setAttribute("aria-controls", topic.anchor);
  tab.textContent = `${topic.number} ${topic.title}`;
  return tab;
}

/**
 * Show the topic section of `topicSections` whose id is `anchor` and hide the others; mark the tab of `tabs` that
 * controls it as the selected one and the row's one tab stop, and no other.
 */
export function showTopic(topicSections, tabs, anchor) {
  for (const section of topicSections) {
    section.hidden = section.id !== anchor;
  }
  for (const tab of tabs) {
    const isShown = tab.getAttribute("aria-controls") === anchor;
    tab.setAttribute("aria-selected", String(isShown));
    tab.tabIndex = isShown ? 0 : -1;
    tab.classList.toggle("is-active", isShown);
  }
}

/**
 * Draw the tabs into `row` for the sections `figureSections` name, show the topic the URL's hash names (the first by
 * default), keep it in the history entry the page opened on, and wire the tabs: a click or a key shows its topic and
 * writes its anchor as a new history entry, and Back and Forward show the topic of the entry they return to.
 * `onShow()` is called each time a topic is shown, after it is, so that its figures are drawn at their cards' width.
 */
export function mountTopicTabs(row, figureSections, onShow) {
  const topics = pageTopics(figureSections);
  const anchors = topics.map((topic) => topic.anchor);
  const tabs = topics.map(topicTab);
  row.replaceChildren(...tabs);
  const view = { row, tabs, topicSections: anchors.map((anchor) => document.getElementById(anchor)), onShow };
  for (const tab of tabs) {
    tab.addEventListener("click", () => chooseTopic(view, tab.getAttribute("aria-controls")));
    tab.addEventListener("keydown", (event) => moveByKey(view, tab, event));
  }
  window.addEventListener("popstate", (event) => {
    showTab(view, topicForEntry(event.state, window.location.hash, anchors, shownTopic(view)));
  });
  mountScrollingRow(row);
  const opened = topicForHash(window.location.hash, anchors, anchors[0]);
  // The entry the page opened on holds its topic, so Back to it shows that topic whatever its anchor names.
  window.history.replaceState({ topic: opened }, "");
  showTab(view, opened);
}

/** A click on the tab of the topic `anchor`: unless it is shown already, write its anchor to the hash and show it. */
function chooseTopic(view, anchor) {
  if (shownTopic(view) === anchor) {
    return;
  }
  // A new history entry holding the topic, so that Back returns to the topic shown before; writing it scrolls nothing.
  window.history.pushState({ topic: anchor }, "", `#${anchor}`);
  showTab(view, anchor);
}

/** A key on `tab`: an arrow, Home or End focuses the tab it names and shows its topic; any other key is left alone. */
function moveByKey(view, tab, event) {
  const index = tabIndexForKey(event.key, view.tabs.indexOf(tab), view.tabs.length);
  if (index === null) {
    return;
  }
  event.preventDefault(); // an arrow would otherwise scroll the row or the page
  const next = view.tabs[index];
  next.focus();
  chooseTopic(view, next.getAttribute("aria-controls"));
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
