import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cachedShare, elapsedSeconds, formatCount, formatElapsed, formatOptionalShare, formatQuantity, formatSeconds,
  formatShare, formatTokens, monthName, shortSessionId, utcMinute,
} from "../site/js/shared/format.js";

test("a count gets thousands separators", () => {
  assert.equal(formatCount(1186582), "1,186,582");
});

test("a token total is shown in its largest unit", () => {
  assert.equal(formatTokens(512), "512");
  assert.equal(formatTokens(129087), "129.1k");
  assert.equal(formatTokens(1_200_000), "1.2M");
  assert.equal(formatTokens(209_000_000_000), "209B");
});

test("a duration is shown in seconds, minutes or hours", () => {
  assert.equal(formatSeconds(4.25), "4.3s");
  assert.equal(formatSeconds(724), "12m 04s");
  assert.equal(formatSeconds(119.6), "2m 00s");
  assert.equal(formatSeconds(3780), "1h 03m");
});

test("elapsed time is minutes and seconds, with hours when needed", () => {
  assert.equal(formatElapsed(0), "+00:00");
  assert.equal(formatElapsed(83.9), "+01:23");
  assert.equal(formatElapsed(3661), "+1:01:01");
});

test("a share is a percentage with one decimal", () => {
  assert.equal(formatShare(0.632), "63.2%");
});

test("an optional share is a percentage, or a dash when it is missing", () => {
  assert.equal(formatOptionalShare(0.632), "63.2%");
  assert.equal(formatOptionalShare(0), "0.0%");
  assert.equal(formatOptionalShare(null), "—");
});

test("a quantity names its noun, singular for exactly one", () => {
  assert.equal(formatQuantity(1, "agent", "agents"), "1 agent");
  assert.equal(formatQuantity(0, "agent", "agents"), "0 agents");
  assert.equal(formatQuantity(5040, "request", "requests"), "5,040 requests");
});

test("elapsed time is in seconds from the origin", () => {
  assert.equal(elapsedSeconds(1_001_500, 1_000_000), 1.5);
  assert.equal(elapsedSeconds(1_000_000, 1_000_000), 0);
});

test("the cached share is cached over reported input", () => {
  assert.equal(cachedShare(150, 200), 0.75);
});

test("the cached share is missing when no input was reported", () => {
  assert.equal(cachedShare(0, 0), null);
});

test("a session's short name is the first eight characters of its id", () => {
  assert.equal(shortSessionId("740dd162030203354c9e55d40fb3a2d5"), "740dd162");
  assert.equal(shortSessionId("tree"), "tree");
});

test("a UTC minute is written as YYYY-MM-DD HH:MM", () => {
  assert.equal(utcMinute(Date.UTC(2026, 0, 2, 3, 4, 5)), "2026-01-02 03:04");
});

test("a month is written as its name and year", () => {
  assert.equal(monthName("2026-07"), "July 2026");
});
