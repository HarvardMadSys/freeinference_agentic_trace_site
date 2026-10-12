/**
 * The site's colours as the style tokens give them.
 *
 * Every colour is a CSS variable from `style.css`, so a chart follows the page into dark mode with no JavaScript.
 * Names get colours from one fixed order, so the same model or provider has the same colour in every chart; a tool
 * category takes its tool group's colour; and a token part, a part of a session's time, a wait cause, a transition, a
 * gap bin and a simulated population always take their own tokens. These are plain constants and functions, tested
 * with `node --test`.
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

/** The colour of each part of a session's time as the paper colours it: prefill, decode, tool and user idle. */
export const TIME_PART_COLOURS = Object.freeze({
  prefill: "var(--part-prefill)",
  decode: "var(--part-decode)",
  tool: "var(--part-tool)",
  user: "var(--part-user)",
});

/**
 * The colour of each part of a request's bar on the Session page's Timeline, as the parts of a session's time are
 * coloured everywhere: time to first token in prefill's, the rest in decode's, and a request with no TTFT, which
 * cannot be split, as one bar in the faint ink.
 */
export const REQUEST_PART_COLOURS = Object.freeze({
  ttft: TIME_PART_COLOURS.prefill,
  decode: TIME_PART_COLOURS.decode,
  whole: "var(--color-text-faint)",
});

/**
 * The colour of each role of a request's input, by the release's name of it, the same in every chart: slots no token
 * part uses, so that a role is never taken for cached or uncached input.
 */
export const ROLE_COLOURS = Object.freeze({
  system: "var(--role-system)",
  user: "var(--role-user)",
  assistant: "var(--role-assistant)",
  tool: "var(--role-tool-results)",
  tool_definitions: "var(--role-tool-definitions)",
});

/** The colour of each wait cause, by the release's `waited_for` value in the paper's order, the same in every chart. */
export const CAUSE_COLOURS = Object.freeze({
  tool: "var(--cause-tool)",
  ask_user_tool: "var(--cause-ask-user)",
  user: "var(--cause-user)",
  subagent: "var(--cause-subagent)",
});

/**
 * The colour of each wait on the Session page's Timeline, by the release's `waited_for` value: a pale tint of the
 * part of a session's time it counts toward, a tool's of the tool part's green, the user's and an ask-user tool's of
 * user idle's red, a subagent's of the subagent cause's violet, which no part uses (`--wait-*` in `style.css`).
 */
export const TIMELINE_WAIT_COLOURS = Object.freeze({
  tool: "var(--wait-tool)",
  ask_user_tool: "var(--wait-user)",
  user: "var(--wait-user)",
  subagent: "var(--wait-subagent)",
});

/** The colour of a tool call on the Timeline: the tool part's, whatever its category, which its tooltip names. */
export const TIMELINE_TOOL_CALL_COLOUR = TIME_PART_COLOURS.tool;

/** The colour of each transition the figures draw: a request appended to its context, or rewrote it. */
export const TRANSITION_COLOURS = Object.freeze({
  append: "var(--transition-append)",
  mutation: "var(--transition-mutation)",
});

/**
 * The colour of each line of the tool latency by batch width: the tool wait of a batch in the colour of a wait for a
 * tool, and the calls made one per request in the ink of a request, as on the Session page's Timeline.
 */
export const BATCH_COLOURS = Object.freeze({
  batched: "var(--cause-tool)",
  serial: "var(--color-text-muted)",
});

/**
 * The colour of each tool group of the tool mix along a turn, by the group's name in the pipeline's order, the same in
 * every chart; Other is the grey of a folded series.
 */
export const TOOL_GROUP_COLOURS = Object.freeze({
  "Read": "var(--tool-group-read)",
  "Search": "var(--tool-group-search)",
  "Write/Edit": "var(--tool-group-write-edit)",
  "Execute": "var(--tool-group-execute)",
  "Build/Test": "var(--tool-group-build-test)",
  "Git/VCS": "var(--tool-group-git-vcs)",
  "Browser/Web": "var(--tool-group-browser-web)",
  "Other": "var(--tool-group-other)",
});

/**
 * The tool group of each tool category that has one, as the pipeline groups them for the tool mix along a turn; every
 * other category is in Other. `*File Ops` has none here: the programs of each call decide its group.
 */
export const TOOL_GROUP_OF_CATEGORY = Object.freeze({
  "Read": "Read",
  "*Search": "Search",
  "Edit": "Write/Edit",
  "Write": "Write/Edit",
  "*Interpreter": "Execute",
  "*Build/Test": "Build/Test",
  "*Git/VCS": "Git/VCS",
  "Browser": "Browser/Web",
  "*Network": "Browser/Web",
});

/**
 * The colour of each scope, by the pipeline's name of it, as the simulation's rows and the scope queries give it: the
 * paper's harnesses (human-driven) blue and the benchmark replay red, as the paper draws them.
 */
export const SCOPE_COLOURS = Object.freeze({
  Agentic: "var(--series-1)",
  "SWE-Bench": "var(--series-8)",
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

/**
 * The entries of `colours` (a Map from name to colour) whose colour is one of the eight series slots, in their order:
 * a line or a CDF of a named series is drawn only for these, since a series in the Other grey could not be told apart.
 */
export function slottedColours(colours) {
  const slotted = new Map();
  for (const [name, colour] of colours) {
    if (colour !== OTHER_SERIES) {
      slotted.set(name, colour);
    }
  }
  return slotted;
}

/** A bar chart's colours: the first eight of `names` in their series colours, and "Other", which the rest fold into. */
export function barColours(names) {
  const colours = assignColours(names.slice(0, SERIES_SLOTS.length));
  colours.set(OTHER_NAME, OTHER_SERIES);
  return colours;
}

/**
 * A map from each tool category of `categories`, in their order but with the category Other last, to its tool group's
 * colour; a category with no group, Other included, takes the grey of a folded series.
 */
export function toolCategoryColours(categories) {
  const colours = new Map();
  for (const category of categories) {
    if (category !== OTHER_NAME) {
      colours.set(category, toolCategoryColour(category));
    }
  }
  if (categories.includes(OTHER_NAME)) {
    colours.set(OTHER_NAME, OTHER_SERIES);
  }
  return colours;
}

/** The colour of the tool category `category`: its tool group's, or the Other grey when it has none. */
export function toolCategoryColour(category) {
  const group = TOOL_GROUP_OF_CATEGORY[category];
  return group === undefined ? OTHER_SERIES : TOOL_GROUP_COLOURS[group];
}

/** A map from each wait cause, by its `waited_for` value in the paper's order, to its colour. */
export function causeColours() {
  return new Map(Object.entries(CAUSE_COLOURS));
}
