import assert from "node:assert/strict";
import { test } from "node:test";

import { topicBarMarkup, topicInView } from "../site/js/explore/topic_bar.js";

// Two topics as `pageTopics` reads them from the Insights page.
const TOPICS = [
  { anchor: "structure", number: "01", title: "Session structure" },
  { anchor: "tokens", number: "02", title: "Tokens and cost" },
];

test("the topic bar links each topic's anchor, its number before its title, in the page's order", () => {
  const markup = topicBarMarkup(TOPICS);
  assert.match(markup, /^<div class="topic-links">.*<\/div>$/);
  const links = [...markup.matchAll(/<a class="nav-link" href="([^"]*)">([^<]*)<\/a>/g)];
  assert.deepEqual(links.map((match) => [match[2], match[1]]), [
    ["01 Session structure", "#structure"],
    ["02 Tokens and cost", "#tokens"],
  ]);
});

test("the topic in view is the first in the page's order whose section reaches below the bar", () => {
  const anchors = ["structure", "tokens", "latency", "tools", "caching", "comparison"];
  assert.equal(topicInView(anchors, new Set(["tokens", "latency"])), "tokens");
  assert.equal(topicInView(anchors, new Set(["caching", "tokens"])), "tokens");
  assert.equal(topicInView(anchors, new Set(["comparison"])), "comparison");
});

test("no topic is in view when no section reaches below the bar", () => {
  assert.equal(topicInView(["structure", "tokens"], new Set()), null);
});
