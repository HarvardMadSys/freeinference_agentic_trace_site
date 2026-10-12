import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { TOKEN_PART_NAMES, tokenPartEntries, tokenParts } from "../site/js/session/token_parts.js";
import { TIME_PART_NAMES } from "../site/js/theme/colours.js";

const SCRIPTS = new URL("../site/js/", import.meta.url);

// The modules that hold the part names: the token parts' and the colours module, beside the time parts' colours.
const NAME_HOMES = ["session/token_parts.js", "theme/colours.js"];

/** Every module under `site/js/`, by its path from there. */
function everyModule() {
  return readdirSync(SCRIPTS, { recursive: true }).filter((path) => path.endsWith(".js"));
}

const REQUEST = { prompt_tokens: 1_000, cache_read_tokens: 600, uncached_tokens: 400, completion_tokens: 50 };

test("a request's tokens are its cached input, uncached input and output", () => {
  assert.deepEqual(tokenParts(REQUEST), { cached: 600, uncached: 400, output: 50 });
});

test("a request with no cache report counts its whole input as uncached", () => {
  const unreported = { ...REQUEST, cache_read_tokens: null, uncached_tokens: null };
  assert.deepEqual(tokenParts(unreported), { cached: 0, uncached: 1_000, output: 50 });
});

test("the legend names the three parts and no other", () => {
  assert.deepEqual(tokenPartEntries().map((entry) => entry.name), ["Cached input", "Uncached input", "Output"]);
  assert.deepEqual(tokenPartEntries().map((entry) => entry.colour), [
    "var(--token-cached)", "var(--token-uncached)", "var(--token-output)",
  ]);
});

test("the part names are typed only in their homes; every other module imports them", () => {
  const names = [...Object.values(TOKEN_PART_NAMES), ...Object.values(TIME_PART_NAMES)];
  for (const module of everyModule()) {
    if (NAME_HOMES.includes(module)) {
      continue;
    }
    const text = readFileSync(new URL(module, SCRIPTS), "utf8");
    for (const name of names) {
      assert.ok(!text.includes(`"${name}"`), `${module} types "${name}"`);
    }
  }
});
