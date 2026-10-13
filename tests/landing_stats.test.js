import assert from "node:assert/strict";
import { test } from "node:test";

import { datesLine, harnessesText } from "../site/js/landing/stats.js";

// Four weeks, the last not simulated, as weeks.json holds them.
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-06-07", last_day: "2026-06-13", month: "2026-06", simulated: true },
  { week: "2026-06-14", last_day: "2026-06-20", month: "2026-06", simulated: false },
];

test("the harnesses are written with the benchmark's apart, and alone when there is none", () => {
  assert.equal(harnessesText({ harnesses: 14, benchmark_harnesses: 1 }), "13 (+1)");
  assert.equal(harnessesText({ harnesses: 3, benchmark_harnesses: 0 }), "3");
});

test("the dates line spans the first Sunday to the last Saturday and names nothing else", () => {
  assert.equal(datesLine(WEEKS), "May 24 – June 20, 2026");
  assert.equal(datesLine(WEEKS.slice(0, 1)), "May 24 – May 30, 2026");
  assert.equal(datesLine([]), "");
});
