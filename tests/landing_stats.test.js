import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { datesLine, harnessesText, statsRows } from "../site/js/landing/stats.js";

// Four weeks, the last not simulated, as weeks.json holds them.
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-06-07", last_day: "2026-06-13", month: "2026-06", simulated: true },
  { week: "2026-06-14", last_day: "2026-06-20", month: "2026-06", simulated: false },
];

// The trace totals as the data step answers them over every week and every harness.
const TOTALS_ROW = {
  sessions: 12002,
  requests: 1186582,
  input_tokens: 209199292539,
  tool_calls: 1213347,
  harnesses: 14,
  benchmark_harnesses: 1,
};

// The shipped data: the indexes and the answers the page reads.
function shipped(path) {
  return JSON.parse(readFileSync(new URL(`../site/data/${path}`, import.meta.url), "utf8"));
}

test("the strip counts the weeks and the trace totals, the largest compactly", () => {
  assert.deepEqual(statsRows(TOTALS_ROW, WEEKS), [
    { value: "4", label: "weeks" },
    { value: "12,002", label: "sessions" },
    { value: "1.2M", label: "requests" },
    { value: "209.2B", label: "input tokens" },
    { value: "1.2M", label: "tool calls" },
    { value: "13 (+1)", label: "harnesses" },
  ]);
});

test("the harnesses are written with the benchmark's apart, and alone when there is none", () => {
  assert.equal(harnessesText({ harnesses: 14, benchmark_harnesses: 1 }), "13 (+1)");
  assert.equal(harnessesText({ harnesses: 3, benchmark_harnesses: 0 }), "3");
});

test("the strip over the shipped data counts every week and the whole trace, as the Session Explorer lists it", () => {
  const weeks = shipped("weeks.json");
  const harnesses = shipped("harnesses.json");
  const [totals] = shipped("all_weeks/explore/trace_totals.json");
  const listed = shipped("all_weeks/explore/sessions_of_selection.json");
  const rows = statsRows(totals, weeks);
  assert.equal(rows[0].value, String(weeks.length));
  assert.equal(rows[1].value, listed.length.toLocaleString("en-US"));
  const benchmarks = harnesses.filter((entry) => entry.benchmark).length;
  assert.equal(rows[5].value, `${harnesses.length - benchmarks} (+${benchmarks})`);
});

test("the dates line spans the first Sunday to the last Saturday and names nothing else", () => {
  assert.equal(datesLine(WEEKS), "May 24 – June 20, 2026");
  assert.equal(datesLine(WEEKS.slice(0, 1)), "May 24 – May 30, 2026");
  assert.equal(datesLine([]), "");
});
