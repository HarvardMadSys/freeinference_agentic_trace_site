/**
 * Where a link to the landing page's old anchors now leads. The Session Explorer and the Insights were once sections
 * of the landing page, and links to them, `index.html#sessions` and `index.html#insights-tokens`, are in the paper's
 * companion links and in shared URLs; the Overview page sends such a link on to the page that holds the section now.
 */

// Each old anchor of a topic of the Insights, without its `#`, and that topic's anchor on the Insights page.
const OLD_TOPIC_ANCHORS = Object.freeze({
  "insights-sessions": "structure",
  "insights-tokens": "tokens",
  "insights-latency": "latency",
  "insights-tools": "tools",
  "insights-caching": "caching",
  "insights-comparison": "comparison",
});

/**
 * The address a link to the landing page with the anchor `hash` and the query `search` (each as `location` gives it,
 * `"#sessions"`, `"?months=2026-07"`) now leads to: `#sessions` to the Session Explorer page with the query, whose keys
 * are its table's; `#insights` to the Insights page; an old topic's anchor to that topic on the Insights page. Null for
 * any other anchor, which stays on the landing page.
 */
export function oldLinkAddress(hash, search) {
  const anchor = hash.slice(1);
  if (anchor === "sessions") {
    return `explorer.html${search}`;
  }
  if (anchor === "insights") {
    return "insights.html";
  }
  if (Object.hasOwn(OLD_TOPIC_ANCHORS, anchor)) {
    return `insights.html#${OLD_TOPIC_ANCHORS[anchor]}`;
  }
  return null;
}
