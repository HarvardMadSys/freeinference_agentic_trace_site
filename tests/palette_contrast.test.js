/**
 * The palette's contrast in both colour schemes, read from `site/style.css`: every series slot and every colour that
 * marks data at least 3:1 on its scheme's card, every text colour at least 4.5:1 on the paper and on a card, each
 * slot the same hue in both schemes, the slots spread round the colour wheel, and the parts of a session's time in
 * the paper's hues.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const STYLESHEET = readFileSync(new URL("../site/style.css", import.meta.url), "utf8");

const MARK_CONTRAST = 3; // a line, bar or swatch is told from its card at 3:1, WCAG's contrast for non-text marks
const TEXT_CONTRAST = 4.5; // text is read at 4.5:1, WCAG's AA contrast for body text
const MAX_HUE_SHIFT = 15; // degrees of OKLCH hue a slot may move between the schemes and keep its identity
const MIN_HUE_GAP = 30; // the fewest degrees of OKLCH hue between any two slots, so the eight spread round the wheel

// The OKLCH hues of the colours the paper draws the four parts of a session's time in: prefill blue (#1f6feb), decode
// orange (#e8710a), tool green (#2da44e) and user idle red (#d1242f).
const PAPER_PART_HUES = { "--part-prefill": 260, "--part-decode": 51, "--part-tool": 148, "--part-user": 25 };

const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8].map((slot) => `--series-${slot}`);

// Colours set as text, read on the paper, on a card and on a card's raised fill.
const TEXT_TOKENS = [
  "--color-text", "--color-text-muted", "--color-text-faint",
  "--color-accent", "--color-accent-strong", "--chart-label",
];

// The families of colours that each stand for something in a chart: a series, a part, a cause, a transition, a bin.
const MARK_PREFIXES = ["--series-", "--part-", "--token-", "--cause-", "--transition-", "--tool-group-", "--gap-bin-"];

// A mark colour outside those families: a request's time to first token on the Timeline.
const OTHER_MARK_TOKENS = ["--request-ttft"];

// Fills and rules that sit behind or beside a mark and stand for nothing alone; no contrast is asked of them.
// A request's rest is the light half of a bar whose dark half, its time to first token, carries the contrast.
const TINT_TOKENS = [
  "--color-background", "--color-surface", "--color-surface-raised", "--color-border", "--color-accent-wash",
  "--color-highlight", "--chart-grid", "--chart-axis", "--request-rest",
];

/** The custom properties declared in `block`, a Map from name to value as written, comments left out. */
function declarations(block) {
  const properties = new Map();
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(match[1], match[2].trim());
  }
  return properties;
}

/** `{ light, dark }`: each scheme's custom properties; the dark block overrides the light one's. */
function schemeTokens(stylesheet) {
  const light = stylesheet.match(/:root\s*\{([^}]*)\}/);
  const dark = stylesheet.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  assert.ok(light && dark, "style.css has a light :root block and a dark one under prefers-color-scheme");
  const lightTokens = declarations(light[1]);
  return { light: lightTokens, dark: new Map([...lightTokens, ...declarations(dark[1])]) };
}

/** The value of token `name` in `tokens`, following `var(--other)` references to the value they name. */
function resolve(tokens, name) {
  const value = tokens.get(name);
  assert.ok(value !== undefined, `${name} is not declared`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  return reference ? resolve(tokens, reference[1]) : value;
}

/** `[red, green, blue]` from 0 to 1 of a colour written `#rgb` or `#rrggbb`; null for any other value. */
function hexChannels(value) {
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) {
    return null;
  }
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16) / 255);
}

/** A channel from 0 to 1 as sRGB writes it, made linear in light. */
function linear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG's relative luminance of a `#rrggbb` colour. */
function luminance(hex) {
  const [red, green, blue] = hexChannels(hex).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG's contrast ratio of two `#rrggbb` colours, from 1 to 21. */
function contrast(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** The OKLCH hue of a `#rrggbb` colour, in degrees from 0 to 360, by the OKLab matrices. */
function oklchHue(hex) {
  const [red, green, blue] = hexChannels(hex).map(linear);
  const long = Math.cbrt(0.4122214708 * red + 0.5363329363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  const greenRed = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const blueYellow = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
  return ((Math.atan2(blueYellow, greenRed) * 180) / Math.PI + 360) % 360;
}

/** The angle between two hues the short way round the wheel, from 0 to 180 degrees. */
function hueDistance(first, second) {
  const apart = Math.abs(first - second) % 360;
  return apart > 180 ? 360 - apart : apart;
}

/** Every token of `tokens` whose value is a colour: a hex, an `rgb()`, or a reference that leads to one. */
function colourTokens(tokens) {
  return [...tokens.keys()].filter((name) => /^(#|rgb\()/.test(resolve(tokens, name)));
}

/** The mark tokens of `tokens`: the families of `MARK_PREFIXES` and `OTHER_MARK_TOKENS`. */
function markTokens(tokens) {
  const marks = colourTokens(tokens).filter((name) => MARK_PREFIXES.some((prefix) => name.startsWith(prefix)));
  return [...marks, ...OTHER_MARK_TOKENS];
}

const SCHEMES = schemeTokens(STYLESHEET);

test("a contrast ratio runs from 1 for one colour to 21 for black on white, whichever is first", () => {
  assert.equal(contrast("#ffffff", "#ffffff"), 1);
  assert.equal(contrast("#000000", "#ffffff"), 21);
  assert.equal(contrast("#ffffff", "#000000"), 21);
  assert.equal(contrast("#777777", "#ffffff").toFixed(2), "4.48");
});

test("a short hex is read as its long form, and anything else is not a hex", () => {
  assert.deepEqual(hexChannels("#fff"), hexChannels("#ffffff"));
  assert.deepEqual(hexChannels("#ff0000"), [1, 0, 0]);
  assert.equal(hexChannels("rgb(0 0 0)"), null);
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
    const card = resolve(tokens, "--color-surface");
    for (const name of markTokens(tokens)) {
      const ratio = contrast(resolve(tokens, name), card);
      assert.ok(ratio >= MARK_CONTRAST, `${scheme} ${name} is ${ratio.toFixed(2)}:1 on the card`);
    }
  }
});

test("every text colour reads at 4.5:1 on the paper, the card and the card's raised fill", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const ground of ["--color-background", "--color-surface", "--color-surface-raised"]) {
      for (const name of TEXT_TOKENS) {
        const ratio = contrast(resolve(tokens, name), resolve(tokens, ground));
        assert.ok(ratio >= TEXT_CONTRAST, `${scheme} ${name} is ${ratio.toFixed(2)}:1 on ${ground}`);
      }
    }
  }
});

test("text on the accent, as on the primary button, reads at 4.5:1 in both schemes", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const accent of ["--color-accent", "--color-accent-strong"]) {
      const ratio = contrast(resolve(tokens, "--color-on-accent"), resolve(tokens, accent));
      assert.ok(ratio >= TEXT_CONTRAST, `${scheme} text on ${accent} is ${ratio.toFixed(2)}:1`);
    }
  }
});

test("each series slot keeps its hue between the schemes", () => {
  for (const slot of SLOTS) {
    const shift = hueDistance(oklchHue(resolve(SCHEMES.light, slot)), oklchHue(resolve(SCHEMES.dark, slot)));
    assert.ok(shift <= MAX_HUE_SHIFT, `${slot} moves ${shift.toFixed(1)}° of hue between the schemes`);
  }
});

test("the eight slots spread round the wheel, no two closer than the smallest gap", () => {
  const hues = SLOTS.map((slot) => oklchHue(resolve(SCHEMES.light, slot)));
  for (let first = 0; first < hues.length; first += 1) {
    for (let second = first + 1; second < hues.length; second += 1) {
      const gap = hueDistance(hues[first], hues[second]);
      assert.ok(gap >= MIN_HUE_GAP, `${SLOTS[first]} and ${SLOTS[second]} are ${gap.toFixed(1)}° apart`);
    }
  }
});

test("the parts of a session's time take the paper's hues: prefill blue, decode orange, tool green, user red", () => {
  for (const [scheme, tokens] of Object.entries(SCHEMES)) {
    for (const [name, hue] of Object.entries(PAPER_PART_HUES)) {
      const shift = hueDistance(oklchHue(resolve(tokens, name)), hue);
      assert.ok(shift <= MAX_HUE_SHIFT, `${scheme} ${name} is ${shift.toFixed(1)}° from the paper's hue`);
    }
  }
});
