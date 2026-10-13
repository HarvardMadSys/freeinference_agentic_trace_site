/**
 * The palette tests' reading of `site/style.css` and their colour arithmetic: each scheme's custom properties, a
 * token's colour, WCAG's contrast, OKLab and OKLCH, and the colours as a deuteranope sees them. Shared by
 * `palette_contrast.test.js` and `palette_meanings.test.js`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const STYLESHEET = readFileSync(new URL("../site/style.css", import.meta.url), "utf8");

// Deuteranopia at full severity on linear sRGB, the Machado (2009) simulation: how a reader without green cones sees.
const DEUTERANOPIA = [
  [0.367322, 0.860646, -0.227968],
  [0.280085, 0.672501, 0.047413],
  [-0.01182, 0.04294, 0.968881],
];

/** The custom properties declared in `block`, a Map from name to value as written, comments left out. */
export function declarations(block) {
  const properties = new Map();
  const withoutComments = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of withoutComments.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    properties.set(match[1], match[2].trim());
  }
  return properties;
}

/** `{ light, dark }`: each scheme's custom properties; the dark block overrides the light one's. */
export function schemeTokens(stylesheet) {
  const light = stylesheet.match(/:root\s*\{([^}]*)\}/);
  const dark = stylesheet.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/);
  assert.ok(light && dark, "style.css has a light :root block and a dark one under prefers-color-scheme");
  const lightTokens = declarations(light[1]);
  return { light: lightTokens, dark: new Map([...lightTokens, ...declarations(dark[1])]) };
}

/** The value of token `name` in `tokens`, following `var(--other)` references to the value they name. */
export function resolve(tokens, name) {
  const value = tokens.get(name);
  assert.ok(value !== undefined, `${name} is not declared`);
  const reference = value.match(/^var\((--[\w-]+)\)$/);
  return reference ? resolve(tokens, reference[1]) : value;
}

/** The colour of token `name` in `tokens`, which must be an opaque `#rrggbb` to be measured. */
export function colourOf(tokens, name) {
  const value = resolve(tokens, name);
  assert.match(value, /^#[0-9a-f]{6}$/i, `${name} is ${value}; a text or mark colour must be an opaque #rrggbb`);
  return value;
}

/** `[red, green, blue]` from 0 to 1 of a colour written `#rgb` or `#rrggbb`; any other value fails an assertion. */
export function hexChannels(value) {
  const match = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  assert.ok(match, `${value} is not an opaque #rgb or #rrggbb colour`);
  const digits = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];
  return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16) / 255);
}

/** A channel from 0 to 1 as sRGB writes it, made linear in light. */
export function linear(channel) {
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG's relative luminance of a `#rrggbb` colour. */
export function luminance(hex) {
  const [red, green, blue] = hexChannels(hex).map(linear);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

/** WCAG's contrast ratio of two `#rrggbb` colours, from 1 to 21. */
export function contrast(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

/** `[lightness, greenRed, blueYellow]` in OKLab of linear `[red, green, blue]`. */
export function oklab([red, green, blue]) {
  const long = Math.cbrt(0.4122214708 * red + 0.5363329363 * green + 0.0514459929 * blue);
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue);
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue);
  return [
    0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short,
  ];
}

/** The OKLCH hue of a `#rrggbb` colour, in degrees from 0 to 360. */
export function oklchHue(hex) {
  const [, greenRed, blueYellow] = oklab(hexChannels(hex).map(linear));
  return ((Math.atan2(blueYellow, greenRed) * 180) / Math.PI + 360) % 360;
}

/** The OKLCH chroma of a `#rrggbb` colour: 0 for a grey, about 0.2 for the most vivid series. */
export function oklchChroma(hex) {
  const [, greenRed, blueYellow] = oklab(hexChannels(hex).map(linear));
  return Math.hypot(greenRed, blueYellow);
}

/** A `#rrggbb` colour in OKLab as a deuteranope sees it: `DEUTERANOPIA` on its linear channels, kept within 0 to 1. */
export function deuteranopeOklab(hex) {
  const channels = hexChannels(hex).map(linear);
  const seen = DEUTERANOPIA.map((row) => row[0] * channels[0] + row[1] * channels[1] + row[2] * channels[2]);
  return oklab(seen.map((channel) => Math.min(1, Math.max(0, channel))));
}

/** The OKLab distance, times 100, between two `#rrggbb` colours as a deuteranope sees them. */
export function deuteranopeDistance(first, second) {
  const [one, other] = [deuteranopeOklab(first), deuteranopeOklab(second)];
  return 100 * Math.hypot(one[0] - other[0], one[1] - other[1], one[2] - other[2]);
}

/** The angle between two hues the short way round the wheel, from 0 to 180 degrees. */
export function hueDistance(first, second) {
  const apart = Math.abs(first - second) % 360;
  return apart > 180 ? 360 - apart : apart;
}

/** Every token of `tokens` whose value is a colour: a hex, an `rgb()`, or a reference that leads to one. */
export function colourTokens(tokens) {
  return [...tokens.keys()].filter((name) => /^(#|rgb\()/.test(resolve(tokens, name)));
}

/** Each scheme's custom properties as `site/style.css` declares them: `{ light, dark }`, the dark over the light. */
export const SCHEMES = schemeTokens(STYLESHEET);
