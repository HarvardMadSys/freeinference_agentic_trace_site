import assert from "node:assert/strict";
import { test } from "node:test";

import { oldLinkAddress } from "../site/js/landing/old_links.js";

test("the old Session Explorer anchor leads to its page, with the table's keys", () => {
  assert.equal(oldLinkAddress("#sessions", "?months=2026-07"), "explorer.html?months=2026-07");
  assert.equal(oldLinkAddress("#sessions", ""), "explorer.html");
});

test("the old Insights anchor leads to the Insights page, without the table's keys", () => {
  assert.equal(oldLinkAddress("#insights", "?months=2026-07"), "insights.html");
});

test("each old topic anchor leads to that topic on the Insights page, Session structure to #structure", () => {
  assert.equal(oldLinkAddress("#insights-sessions", ""), "insights.html#structure");
  assert.equal(oldLinkAddress("#insights-tokens", "?months=2026-07"), "insights.html#tokens");
  assert.equal(oldLinkAddress("#insights-latency", ""), "insights.html#latency");
  assert.equal(oldLinkAddress("#insights-tools", ""), "insights.html#tools");
  assert.equal(oldLinkAddress("#insights-caching", ""), "insights.html#caching");
  assert.equal(oldLinkAddress("#insights-comparison", ""), "insights.html#comparison");
});

test("any other anchor, or none, stays on the landing page", () => {
  for (const hash of ["", "#overview", "#cite", "#team", "#insights-unknown", "#constructor", "#tokens"]) {
    assert.equal(oldLinkAddress(hash, "?months=2026-07"), null, hash);
  }
});
