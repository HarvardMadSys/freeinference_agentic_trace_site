import assert from "node:assert/strict";
import { test } from "node:test";

import {
  batchLegend, durationTick, LATENCY_BY_BATCH_WIDTH, waitAxisEnd, widthLabel, WIDEST_DRAWN,
} from "../site/js/figures/tools_batching.js";
import { dropThinGroups } from "../site/js/figures/figure_rows.js";
import { BATCH_COLOURS } from "../site/js/theme/colours.js";

// Rows of the batch-width query: one-call requests, and the widest width, which holds requests of eight calls or more.
const ROWS = [
  { width: 1, rows: 900, p10: 0.4, p25: 0.7, p50: 1.8, p75: 5, p90: 17.8, serial_s: 6.4 },
  { width: WIDEST_DRAWN, rows: 40, p10: 0.5, p25: 0.8, p50: 1.7, p75: 6.6, p90: 24.6, serial_s: 50.9 },
];

test("the legend lists the batched calls and the serial line, each in its own colour", () => {
  const { series, colours } = batchLegend();
  assert.deepEqual(series, [
    { name: "batched", label: "Batched calls" },
    { name: "serial", label: "One call per request" },
  ]);
  assert.equal(colours.get("batched"), BATCH_COLOURS.batched);
  assert.equal(colours.get("serial"), BATCH_COLOURS.serial);
});

test("the widest width reads as that many calls or more", () => {
  assert.equal(widthLabel(1), "1");
  assert.equal(widthLabel(WIDEST_DRAWN), "8+");
});

test("a duration tick is in seconds under a minute and in minutes from one", () => {
  assert.equal(durationTick(0), "0 s");
  assert.equal(durationTick(50), "50 s");
  assert.equal(durationTick(120), "2 min");
});

test("the wait axis reaches past the highest line shown, and no further", () => {
  assert.equal(waitAxisEnd(ROWS, new Set(["batched", "serial"])), 50.9 * 1.05);
  assert.equal(waitAxisEnd(ROWS, new Set(["batched"])), 24.6 * 1.05);
  assert.equal(waitAxisEnd(ROWS, new Set()), 0);
});

test("a width of too few requests is hidden whole", () => {
  const { rows, hidden } = dropThinGroups(ROWS, LATENCY_BY_BATCH_WIDTH.binColumn);
  assert.deepEqual(rows.map((row) => row.width), [1]);
  assert.equal(hidden, 1);
});
