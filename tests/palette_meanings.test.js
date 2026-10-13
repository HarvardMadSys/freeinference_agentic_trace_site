/**
 * What a colour of `site/style.css` may share with another, in both colour schemes: the token parts take no colour of
 * a part of a session's time, the roles of the input none of a token part's, and the tool categories without a group
 * hues of their own.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { colourOf, hueDistance, oklchChroma, oklchHue, SCHEMES } from "./palette.js";

// The fewest degrees of OKLCH hue between a colour that must be told apart from others and each of them: a tool
// category without a group from every group's, a role of the input from every token part's and time part's.
const MIN_MEANING_HUE_GAP = 15;
const GREY_CHROMA = 0.03; // a colour of less OKLCH chroma is a grey, whose hue says nothing and is shared with no one

// The colours of the parts of a session's time, of a request's tokens and of the roles of its input.
const TIME_PART_TOKENS = ["--part-prefill", "--part-decode", "--part-tool", "--part-user"];
const TOKEN_PART_TOKENS = ["--token-cached", "--token-uncached", "--token-output"];
const ROLE_TOKENS = ["--role-system", "--role-user", "--role-assistant", "--role-tool-results", "--role-tool-definitions"];

/** The names of `firsts` and `seconds` that resolve to one colour in `tokens`, as `"--a = --b"`. */
function sharedColours(tokens, firsts, seconds) {
  const shared = [];
  for (const first of firsts) {
    for (const second of seconds) {
      if (colourOf(tokens, first) === colourOf(tokens, second)) {
        shared.push(`${first} = ${second}`);
      }
    }
  }
  return shared;
}

test("the token parts take colours no part of a session's time takes, and the roles none a token part takes", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    assert.deepEqual(sharedColours(tokens, TOKEN_PART_TOKENS, TIME_PART_TOKENS), [], `${scheme}: tokens and time`);
    assert.deepEqual(sharedColours(tokens, ROLE_TOKENS, TOKEN_PART_TOKENS), [], `${scheme}: roles and tokens`);
  }
});

// The tool groups' colours, and the tool categories without a group, which take colours of their own.
const TOOL_GROUP_TOKENS = [
  "--tool-group-read", "--tool-group-search", "--tool-group-write-edit", "--tool-group-execute",
  "--tool-group-build-test", "--tool-group-git-vcs", "--tool-group-browser-web",
];
const TOOL_CATEGORY_TOKENS = [
  "--tool-category-mcp", "--tool-category-subagent", "--tool-category-ask-user", "--tool-category-packages",
  "--tool-category-wait-poll", "--tool-category-file-ops",
];

/**
 * The pairs of `firsts` and `seconds` whose hues in `tokens` lie closer than `MIN_MEANING_HUE_GAP`, as `"--a ~ --b"`;
 * a grey has no hue, so a pair with one is never close.
 */
function closeHues(tokens, firsts, seconds) {
  const close = [];
  for (const first of firsts) {
    for (const second of seconds) {
      const [one, other] = [colourOf(tokens, first), colourOf(tokens, second)];
      const isGrey = oklchChroma(one) < GREY_CHROMA || oklchChroma(other) < GREY_CHROMA;
      const gap = hueDistance(oklchHue(one), oklchHue(other));
      if (first !== second && !isGrey && gap < MIN_MEANING_HUE_GAP) {
        close.push(`${first} ~ ${second} (${gap.toFixed(1)}°)`);
      }
    }
  }
  return close;
}

test("a tool category without a group takes a hue no group and no other such category takes, in both schemes", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    assert.deepEqual(closeHues(tokens, TOOL_CATEGORY_TOKENS, TOOL_GROUP_TOKENS), [], `${scheme}: categories and groups`);
    assert.deepEqual(closeHues(tokens, TOOL_CATEGORY_TOKENS, TOOL_CATEGORY_TOKENS), [], `${scheme}: categories`);
  }
});

test("the token parts, the parts of a session's time and the roles of the input are pairwise distinct", () => {
  // The user's, the assistant's and tool results' roles take the colours of the parts of time they come from, so a
  // role is held apart from the time parts only when it comes from none: the system prompt and the tool definitions.
  const rolesOfNoTimePart = ["--role-system", "--role-tool-definitions"];
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    assert.deepEqual(closeHues(tokens, TOKEN_PART_TOKENS, TIME_PART_TOKENS), [], `${scheme}: tokens and time`);
    assert.deepEqual(closeHues(tokens, ROLE_TOKENS, TOKEN_PART_TOKENS), [], `${scheme}: roles and tokens`);
    assert.deepEqual(closeHues(tokens, rolesOfNoTimePart, TIME_PART_TOKENS), [], `${scheme}: roles and time`);
    assert.deepEqual(closeHues(tokens, ROLE_TOKENS, ROLE_TOKENS), [], `${scheme}: roles`);
  }
});
