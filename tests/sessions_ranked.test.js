import assert from "node:assert/strict";
import { test } from "node:test";

import { COST_SHARE_BY_SESSION, SESSION_TIME_BY_PART } from "../site/js/figures/sessions_ranked.js";
import { rankTips } from "../site/js/charts/ranked.js";
import { dropThinGroups, restingCountText } from "../site/js/explore/figure_rows.js";

test("the session time's tooltip names the four parts with their shares", () => {
  const row = { percentile: 50, prefill: 0.125, decode: 0.125, tool: 0.25, user: 0.5, bin_sessions: 10 };
  const labels = Object.fromEntries(SESSION_TIME_BY_PART.legend().series.map((one) => [one.name, one.label]));
  const [tip] = rankTips([row], ["prefill", "decode", "tool", "user"], labels);
  assert.equal(tip.top, 1);
  assert.equal(tip.text, "Percentile 50.0\nPrefill: 12.5%\nDecode: 12.5%\nTool wait: 25.0%\nUser idle: 50.0%\n10 sessions");
});

// Eight rank bins of 13 sessions each, every one under the page's 50 rows a bin, of 104 sessions ranked.
const SMALL_BIN_ROWS = Array.from({ length: 8 }, (unused, bin) => ({
  percentile: (bin + 0.5) * 12.5,
  prefill: 0.25,
  decode: 0.25,
  tool: 0.25,
  user: 0.25,
  bin_sessions: 13,
  ranked_bin: "ranked sessions",
  rows: 104,
}));

test("a rank-bin figure is drawn whole when its sessions are enough, however small each bin, and counts them once", () => {
  for (const figure of [COST_SHARE_BY_SESSION, SESSION_TIME_BY_PART]) {
    const { rows, hidden } = dropThinGroups(SMALL_BIN_ROWS, figure.binColumn);
    assert.equal(rows.length, SMALL_BIN_ROWS.length, figure.name);
    assert.equal(hidden, 0, figure.name);
    assert.equal(restingCountText(rows, figure), "104 rows", figure.name);
  }
});
