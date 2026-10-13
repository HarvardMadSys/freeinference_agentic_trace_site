/**
 * The palette's contrast in both colour schemes, read from `site/style.css`: every series slot and every colour that
 * marks data at least 3:1 on its scheme's card, every text colour at least 4.5:1 on the paper and on a card, each
 * slot the same hue in both schemes, the slots spread round the colour wheel and apart for a red-green colour-blind
 * reader, and the parts of a session's time in the paper's hues; what a colour may share with another is checked in
 * `palette_meanings.test.js`.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  colourOf, colourTokens, contrast, deuteranopeDistance, hexChannels, hueDistance, oklchHue, resolve, SCHEMES,
  schemeTokens,
} from "./palette.js";

const MARK_CONTRAST = 3; // a line, bar or swatch is told from its card at 3:1, WCAG's contrast for non-text marks
const TEXT_CONTRAST = 4.5; // text is read at 4.5:1, WCAG's AA contrast for body text
const MAX_HUE_SHIFT = 15; // degrees of OKLCH hue a slot may move between the schemes and keep its identity
const MIN_HUE_GAP = 30; // the fewest degrees of OKLCH hue between any two slots, so the eight spread round the wheel
const MIN_DEUTERANOPE_DISTANCE = 5; // OKLab distance (×100) any two slots keep as a deuteranope sees them

// The OKLCH hues of the colours the paper draws the four parts of a session's time in: prefill blue (#1f6feb), decode
// orange (#e8710a), tool green (#2da44e) and user idle red (#d1242f).
const PAPER_PART_HUES = { "--part-prefill": 260, "--part-decode": 51, "--part-tool": 148, "--part-user": 25 };

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => `--series-${slot}`);

// Colours set as text, read on the paper, on a card and on a card's raised fill.
const TEXT_TOKENS = [
  "--color-text", "--color-text-muted", "--color-text-faint",
  "--color-accent", "--color-accent-strong", "--chart-label",
];

// The families of colours that each stand for something in a chart: a series, a part, a cause, a role, a transition,
// a tool group, a tool category without one, a bin.
const MARK_PREFIXES = [
  "--series-", "--part-", "--token-", "--cause-", "--role-", "--transition-", "--tool-group-", "--tool-category-",
  "--gap-bin-",
];

// Fills and rules that sit behind or beside a mark and stand for nothing alone; no contrast is asked of them.
const TINT_TOKENS = [
  "--color-background", "--color-surface", "--color-surface-raised", "--color-border", "--color-accent-wash",
  "--color-highlight", "--chart-grid", "--chart-axis", "--wait-tint-base",
];

/** The mark tokens of `tokens`: the families of `MARK_PREFIXES`. */
function markTokens(tokens) {
  const marks = colourTokens(tokens).filter((name) => MARK_PREFIXES.some((prefix) => name.startsWith(prefix)));
  return marks;
}

test("a contrast ratio runs from 1 for one colour to 21 for black on white, whichever is first", () => {
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#000000"), 21);
  assert.equal(contrast("#777777", "#ffffff").toFixed(2), "4.48");
});

test("a short hex is read as its long form, and anything else fails with the value named", () => {
  assert.deepEqual(hexChannels("#fff"), hexChannels("#ffffff"));
  assert.deepEqual(hexChannels("#ff0000"), [1, 0, 0]);
  assert.throws(() => hexChannels("rgb(0 0 0)"), /rgb\(0 0 0\) is not an opaque/);
  const tokens = new Map([["--mark", "rgb(0 0 0 / 0.5)"]]);
  assert.throws(() => colourOf(tokens, "--mark"), /--mark is rgb\(0 0 0 \/ 0.5\); a text or mark colour must be/);
});

test("a deuteranope tells black from white fully, but not an orange from an amber of the same lightness", () => {
  assert.equal(deuteranopeDistance("#000000", "#ffffff").toFixed(1), "100.0");
  assert.ok(deuteranopeDistance("#df6d19", "#b28619") < MIN_DEUTERANOPE_DISTANCE);
});

test("OKLCH hues of the primaries, and distances that go the short way round", () => {
  assert.equal(oklchHue("#ff0000").toFixed(1), "29.2");
  assert.equal(oklchHue("#00ff00").toFixed(1), "142.5");
  assert.equal(oklchHue("#0000ff").toFixed(1), "264.1");
  assert.equal(hueDistance(350, 10), 20);
  assert.equal(hueDistance(10, 190), 180);
});

test("the dark block overrides the light one's tokens, and a reference resolves to the scheme's value", () => {
  const css = ":root { --a: #fff; --b: var(--a); /* --c: #000; */ }\n"
    + "@media (prefers-color-scheme: dark) { :root { --a: #000; } }";
  const { light, dark } = schemeTokens(css);
  assert.equal(resolve(light, "--b"), "#fff");
  assert.equal(resolve(dark, "--b"), "#000");
  assert.equal(light.has("--c"), false);
});

test("every colour token is text, a mark or a tint, so none goes unchecked", () => {
  for (const tokens of Object.values(SCHEMES)) {
    const known = [...TEXT_TOKENS, ...markTokens(tokens), ...TINT_TOKENS, "--color-on-accent"];
    for (const name of colourTokens(tokens)) {
      assert.ok(known.includes(name), `${name} is a colour with no contrast rule`);
    }
  }
});

test("every mark colour stands 3:1 against its scheme's card", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    const card = colourOf(tokens, "--color-surface");
    for (const name of markTokens(tokens)) {
      const ratio = contrast(colourOf(tokens, name), card);
      assert.ok(ratio >= MARK_CONTRAST, `${scheme} ${name} is ${ratio.toFixed(2)}:1 on the card`);
    }
  }
});

test("every text colour reads at 4.5:1 on the paper, the card and the card's raised fill", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const ground of ["--color-background", "--color-surface", "--color-surface-raised"]) {
      for (const name of TEXT_TOKENS) {
        const ratio = contrast(colourOf(tokens, name), colourOf(tokens, ground));
        assert.ok(ratio >= TEXT_CONTRAST, `${scheme} ${name} is ${ratio.toFixed(2)}:1 on ${ground}`);
      }
    }
  }
});

test("text on the accent, as on the primary button, reads at 4.5:1 in both schemes", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const accent of ["--color-accent", "--color-accent-strong"]) {
      const ratio = contrast(colourOf(tokens, "--color-on-accent"), colourOf(tokens, accent));
      assert.ok(ratio >= TEXT_CONTRAST, `${scheme} text on ${accent} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("each series slot keeps its hue between the schemes", () => {
  for (const slot of SLOTS) {
    const shift = hueDistance(oklchHue(colourOf(SCHEMES.light, slot)), oklchHue(colourOf(SCHEMES.dark, slot)));
    assert.ok(shift <= MAX_HUE_SHIFT, `${slot} moves ${shift.toFixed(1)}° of hue between the schemes`);
  }
});

test("the eight slots spread round the wheel in both schemes, no two closer than the smallest gap", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    const hues = SLOTS.map((slot) => oklchHue(colourOf(tokens, slot)));
    for (let first = 0; first < hues.length; first += 1) {
      for (let second = first + 1; second < hues.length; second += 1) {
        const gap = hueDistance(hues[first], hues[second]);
        assert.ok(gap >= MIN_HUE_GAP, `${scheme} ${SLOTS[first]} and ${SLOTS[second]} are ${gap.toFixed(1)}° apart`);
      }
    }
  }
});

test("a deuteranope tells every pair of slots apart in both schemes", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (let first = 0; first < SLOTS.length; first += 1) {
      for (let second = first + 1; second < SLOTS.length; second += 1) {
        const distance = deuteranopeDistance(colourOf(tokens, SLOTS[first]), colourOf(tokens, SLOTS[second]));
        const pair = `${scheme} ${SLOTS[first]} and ${SLOTS[second]}`;
        assert.ok(distance >= MIN_DEUTERANOPE_DISTANCE, `${pair} are ${distance.toFixed(1)} apart to a deuteranope`);
      }
    }
  }
});

test("the parts of a session's time take the paper's hues: prefill blue, decode orange, tool green, user red", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const [name, hue] of Object.entries(PAPER_PART_HUES)) {
      const shift = hueDistance(oklchHue(colourOf(tokens, name)), hue);
      assert.ok(shift <= MAX_HUE_SHIFT, `${scheme} ${name} is ${shift.toFixed(1)}° from the paper's hue`);
    }
  }
});
