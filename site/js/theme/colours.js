/**
 * The site's colours as the style tokens give them.
 *
 * Every colour is a CSS variable from `style.css`, so a chart follows the page into dark mode with no JavaScript.
 * Names get colours from one fixed order, so the same model, category, provider or policy has the same colour in
 * every chart, and a token part, a wait cause, a transition and a gap bin always take their own tokens. These are
 * plain constants and functions, tested with `node --test`.
 */

/** The eight series colours, in order. A chart assigns them in order and never cycles: a ninth series is "Other". */
export const SERIES_SLOTS = Object.freeze([
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
]);

/** The colour of every series past the eighth, folded together as "Other". */
export const OTHER_SERIES = "var(--series-other)";

/** The name a series past the eighth takes once folded; it is here because `barColours` gives it `OTHER_SERIES`. */
export const OTHER_NAME = "Other";

/** The colour of each part of a request's tokens, the same in every chart. */
export const TOKEN_PART_COLOURS = Object.freeze({
  cached: "var(--token-cached)",
  uncached: "var(--token-uncached)",
  output: "var(--token-output)",
});

/** The colour of each wait cause, by the release's `waited_for` value in the paper's order, the same in every chart. */
export const CAUSE_COLOURS = Object.freeze({
  tool: "var(--cause-tool)",
  ask_user_tool: "var(--cause-ask-user)",
  user: "var(--cause-user)",
  subagent: "var(--cause-subagent)",
});

/** The colour of each transition the figures draw: a request appended to its context, or rewrote it. */
export const TRANSITION_COLOURS = Object.freeze({
  append: "var(--transition-append)",
  mutation: "var(--transition-mutation)",
});

/** The six gap-bin colours, shortest gap first: one blue from light to dark. */
export const GAP_BIN_SLOTS = Object.freeze([
  "var(--gap-bin-1)",
  "var(--gap-bin-2)",
  "var(--gap-bin-3)",
  "var(--gap-bin-4)",
  "var(--gap-bin-5)",
  "var(--gap-bin-6)",
]);

/** A map from each distinct name, in the given order, to its series colour; the ninth and beyond to `OTHER_SERIES`. */
export function assignColours(names) {
  const colours = new Map();
  for (const name of names) {
    if (colours.has(name)) {
      continue;
    }
    const slot = colours.size < SERIES_SLOTS.length ? SERIES_SLOTS[colours.size] : OTHER_SERIES;
    colours.set(name, slot);
  }
  return colours;
}

/** A bar chart's colours: the first eight of `names` in their series colours, and "Other", which the rest fold into. */
export function barColours(names) {
  const colours = assignColours(names.slice(0, SERIES_SLOTS.length));
  colours.set(OTHER_NAME, OTHER_SERIES);
  return colours;
}

/** A map from each wait cause, by its `waited_for` value in the paper's order, to its colour. */
export function causeColours() {
  return new Map(Object.entries(CAUSE_COLOURS));
}
