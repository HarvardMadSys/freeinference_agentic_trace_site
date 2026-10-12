import assert from "node:assert/strict";
import { test } from "node:test";

import {
  cachedShare, elapsedSeconds, formatCount, formatDurationTick, formatElapsed, formatMultiple, formatOptionalShare,
  formatQuantity, formatSeconds, formatShare, formatTokens, monthName, shortSessionId, utcMinute,
  elapsedTickFormat, formatBinaryThousands, formatCompactCount, formatPercent, formatTtlName, monthAndDay,
  monthSpanText, shortMinute, shortMonth, formatWholeCount,
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

test("a duration is written in the axes' words with one decimal at most", () => {
  assert.equal(formatSeconds(4.25), "4.3 s");
  assert.equal(formatSeconds(61), "61 s");
  assert.equal(formatSeconds(724), "12.1 min");
  assert.equal(formatSeconds(119.6), "2 min");
  assert.equal(formatSeconds(6480), "1.8 h");
  assert.equal(formatSeconds(328000), "3.8 d");
  assert.equal(formatSeconds(0.04), "0.04 s");
  assert.equal(formatSeconds(0), "0 s");
});

test("a duration tick is in the largest unit it reaches, to one decimal at most", () => {
  assert.equal(formatDurationTick(0), "0 s");
  assert.equal(formatDurationTick(0.1), "0.1 s");
  assert.equal(formatDurationTick(50), "50 s");
  assert.equal(formatDurationTick(60), "1 min");
  assert.equal(formatDurationTick(80), "1.3 min");
  assert.equal(formatDurationTick(90), "1.5 min");
  assert.equal(formatDurationTick(120), "2 min");
  assert.equal(formatDurationTick(3600), "1 h");
  assert.equal(formatDurationTick(86400), "1 d");
  assert.equal(formatDurationTick(604800), "7 d");
});

test("a multiple has a times sign and the decimals asked for, or is written as it is", () => {
  assert.equal(formatMultiple(1.3757185, 2), "1.38×");
  assert.equal(formatMultiple(3.1066, 1), "3.1×");
  assert.equal(formatMultiple(1, 2), "1.00×");
  assert.equal(formatMultiple(2), "2×");
  assert.equal(formatMultiple(0.4), "0.4×");
});

test("elapsed time is minutes and seconds, with hours when needed", () => {
  assert.equal(formatElapsed(0), "0:00");
  assert.equal(formatElapsed(83.9), "1:23");
  assert.equal(formatElapsed(3661), "1:01:01");
});

test("a share is a percentage with one decimal at most, a whole one with none", () => {
  assert.equal(formatShare(0.632), "63.2%");
  assert.equal(formatShare(1), "100%");
});

test("a percentile of counts is written as a whole count", () => {
  assert.equal(formatWholeCount(368.4), "368");
  assert.equal(formatWholeCount(5040), "5,040");
});

test("an optional share is a percentage, or a dash when it is missing", () => {
  assert.equal(formatOptionalShare(0.632), "63.2%");
  assert.equal(formatOptionalShare(0), "0%");
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

test("a compact count is in its largest unit, lower-case k, a round one with no decimal", () => {
  assert.equal(formatCompactCount(300000), "300k");
  assert.equal(formatCompactCount(1000), "1k");
  assert.equal(formatCompactCount(1_800_000), "1.8M");
  assert.equal(formatCompactCount(250), "250");
});

test("a power-of-two token count is written in units of 1,024", () => {
  assert.equal(formatBinaryThousands(4096), "4k");
  assert.equal(formatBinaryThousands(262144), "256k");
  assert.equal(formatBinaryThousands(512), "512");
});

test("an axis's percentage has no decimals", () => {
  assert.equal(formatPercent(1), "100%");
  assert.equal(formatPercent(0), "0%");
  assert.equal(formatPercent(0.632), "63%");
});

test("a TTL's name is written as every duration is, never m for a minute", () => {
  assert.equal(formatTtlName("1m"), "1 min");
  assert.equal(formatTtlName("10s"), "10 s");
  assert.equal(formatTtlName("6h"), "6 h");
  assert.equal(formatTtlName("1d"), "1 d");
});

test("an elapsed axis writes h:mm from an hour on, else m:ss", () => {
  assert.deepEqual([elapsedTickFormat(4200).unit, elapsedTickFormat(4200).format(4200)], ["h:mm", "1:10"]);
  assert.deepEqual([elapsedTickFormat(750).unit, elapsedTickFormat(750).format(750)], ["m:ss", "12:30"]);
});

test("a date is written as its short month and day, or its month alone on a week axis", () => {
  assert.equal(monthAndDay("2026-08-09"), "Aug 9");
  assert.equal(shortMonth("2026-05-17"), "May");
  assert.equal(shortMinute(Date.UTC(2026, 7, 31, 2, 44)), "Aug 31, 02:44");
});

test("a span of months names the year once when both share it", () => {
  assert.equal(monthSpanText("2026-05", "2026-08"), "May to August 2026");
  assert.equal(monthSpanText("2025-12", "2026-01"), "December 2025 to January 2026");
  assert.equal(monthSpanText("2026-05", "2026-05"), "May 2026");
});
