import assert from "node:assert/strict";
import { test } from "node:test";

import { formatCount, formatElapsed, formatOptionalShare, formatSeconds, formatShare, formatTokens } from "../site/js/shared/format.js";

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
