import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { datesLine, statsRows } from "../site/js/landing/stats.js";
import { defaultSelection } from "../site/js/shared/selection.js";

// Four weeks, the last not simulated, as weeks.json holds them.
const WEEKS = [
  { week: "2026-05-24", last_day: "2026-05-30", month: "2026-05", simulated: true },
  { week: "2026-05-31", last_day: "2026-06-06", month: "2026-05", simulated: true },
  { week: "2026-06-07", last_day: "2026-06-13", month: "2026-06", simulated: true },
  { week: "2026-06-14", last_day: "2026-06-20", month: "2026-06", simulated: false },
];

// Three harnesses, the second the benchmark, as harnesses.json holds them.
const HARNESSES = [
  { harness: "hermes", sessions: 3953, benchmark: false },
  { harness: "eval:swe-bench", sessions: 1035, benchmark: true },
  { harness: "codex", sessions: 763, benchmark: false },
];

const HEADLINE_ROW = {
  sessions: 10967,
  accounts: 261,
  requests: 1125604,
  input_tokens: 207377727534,
  output_tokens: 540625452,
  tool_calls: 1152306,
  subagents: 2034,
  reported_input_tokens: 200187812585,
  cached_tokens: 195535670543,
};

// The shipped data: the indexes and the headline answer the page reads.
function shipped(path) {
  return JSON.parse(readFileSync(new URL(`../site/data/${path}`, import.meta.url), "utf8"));
}

test("the strip counts the selection's weeks and harnesses and the headline row's totals, the largest compactly", () => {
  assert.deepEqual(statsRows(HEADLINE_ROW, defaultSelection(WEEKS, HARNESSES)), [
    { value: "4", label: "weeks" },
    { value: "10,967", label: "sessions" },
    { value: "1.1M", label: "requests" },
    { value: "207.4B", label: "input tokens" },
    { value: "1.2M", label: "tool calls" },
    { value: "2", label: "harnesses" },
  ]);
});

test("the strip over the shipped data counts every week, the paper's harnesses and the headline answer", () => {
  const weeks = shipped("weeks.json");
  const harnesses = shipped("harnesses.json");
  const [headline] = shipped("all_weeks/explore/headline_numbers.json");
  const rows = statsRows(headline, defaultSelection(weeks, harnesses));
  assert.equal(rows[0].value, String(weeks.length));
  assert.equal(rows[1].value, headline.sessions.toLocaleString("en-US"));
  assert.equal(rows[5].value, String(harnesses.filter((entry) => !entry.benchmark).length));
});

test("the dates line spans the first Sunday to the last Saturday and names the weeks the simulation leaves out", () => {
  assert.equal(datesLine(WEEKS), "May 24 to June 20, 2026; the cache simulation covers all but 2026-06-14.");
  assert.equal(datesLine(WEEKS.slice(0, 3)), "May 24 to June 13, 2026; the cache simulation covers all 3 weeks.");
  assert.equal(datesLine(WEEKS.slice(0, 1)), "May 24 to May 30, 2026; the cache simulation covers its week.");
  assert.equal(datesLine(WEEKS.slice(3)), "June 14 to June 20, 2026; the cache simulation covers no week.");
  assert.equal(datesLine([]), "");
});
