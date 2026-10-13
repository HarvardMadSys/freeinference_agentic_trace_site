/**
 * The site's colours as the style tokens give them.
 *
 * Every colour is a CSS variable from `style.css`, so a chart follows the page into dark mode with no JavaScript.
 * Names get colours from one fixed order, so the same model or provider has the same colour in every chart; a tool
 * category has one colour of its own, its tool group's where it has one; and a token part, a part of a session's time, a wait cause, a transition, a
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

/**
 * Violet, the seventh series slot and the one neither a token part nor a part of a session's time uses: the colour of
 * a series that is neither, such as the whole input beside its token parts, or the subagents' line.
 */
export const VIOLET_SLOT = SERIES_SLOTS[6];

/** The colour of every series past the eighth, folded together as "Other". */
export const OTHER_SERIES = "var(--series-other)";

/** The name a series past the eighth takes once folded; it is here because `barColours` gives it `OTHER_SERIES`. */
export const OTHER_NAME = "Other";

/**
 * The series slot the harnesses' colours start from, where the models' start from the first: the harness mix and the
 * model mix side by side then open on different colours, so the largest harness is not taken for the largest model.
 */
export const HARNESS_FIRST_SLOT = 4;

/**
 * The colour of each part of a request's tokens, the same in every chart: slots no part of a session's time uses, so
 * that a chart of tokens and a chart of time of the same form never give one hue two meanings.
 */
export const TOKEN_PART_COLOURS = Object.freeze({
  cached: "var(--token-cached)",
  uncached: "var(--token-uncached)",
  output: "var(--token-output)",
});
/** `TOKEN_PART_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const TOKEN_PART_COLOUR_MAP = new Map(Object.entries(TOKEN_PART_COLOURS));

/** The colour of each part of a session's time as the paper colours it: prefill, decode, tool and user idle. */
export const TIME_PART_COLOURS = Object.freeze({
  prefill: "var(--part-prefill)",
  decode: "var(--part-decode)",
  tool: "var(--part-tool)",
  user: "var(--part-user)",
});
/** `TIME_PART_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const TIME_PART_COLOUR_MAP = new Map(Object.entries(TIME_PART_COLOURS));

/** The name of each part of a session's time in every legend, tooltip and label, by the keys of its colours. */
export const TIME_PART_NAMES = Object.freeze({
  prefill: "Prefill",
  decode: "Decode",
  tool: "Tool wait",
  user: "User idle",
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
 * part uses, so that a role is never taken for a token part; the user's, the assistant's and tool results take the
 * colours of the parts of a session's time they come from (`--role-*` in `style.css`).
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
/** `CAUSE_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const CAUSE_COLOUR_MAP = new Map(Object.entries(CAUSE_COLOURS));

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
/** `TRANSITION_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const TRANSITION_COLOUR_MAP = new Map(Object.entries(TRANSITION_COLOURS));

/**
 * The colour of each line of the tool latency by batch width: the tool wait of a batch in the colour of a wait for a
 * tool, and the calls made one per request in the ink of a request, as on the Session page's Timeline.
 */
export const BATCH_COLOURS = Object.freeze({
  batched: "var(--cause-tool)",
  serial: "var(--color-text-muted)",
});
/** `BATCH_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const BATCH_COLOUR_MAP = new Map(Object.entries(BATCH_COLOURS));

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
/** `TOOL_GROUP_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const TOOL_GROUP_COLOUR_MAP = new Map(Object.entries(TOOL_GROUP_COLOURS));

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

// The colour of each tool category of `TOOL_GROUP_OF_CATEGORY`: its tool group's.
function groupColourOfEachCategory() {
  const colours = {};
  for (const [category, group] of Object.entries(TOOL_GROUP_OF_CATEGORY)) {
    colours[category] = TOOL_GROUP_COLOURS[group];
  }
  return colours;
}

/**
 * The colour of each tool category of the release, the same in every chart: a category with a tool group
 * (`TOOL_GROUP_OF_CATEGORY`) takes the group's, and the six without one each a colour of their own
 * (`--tool-category-*` in `style.css`), so that the Other grey is the category Other's alone.
 */
export const TOOL_CATEGORY_COLOURS = Object.freeze({
  ...groupColourOfEachCategory(),
  "MCP": "var(--tool-category-mcp)",
  "Subagent": "var(--tool-category-subagent)",
  "Ask User": "var(--tool-category-ask-user)",
  "*Packages": "var(--tool-category-packages)",
  "*Wait/Poll": "var(--tool-category-wait-poll)",
  "*File Ops": "var(--tool-category-file-ops)",
  "Other": OTHER_SERIES,
});

/**
 * The colour of each scope, by the pipeline's name of it, as the simulation's rows and the scope queries give it: the
 * paper's harnesses (human-driven) blue and the benchmark replay red, as the paper draws them.
 */
export const SCOPE_COLOURS = Object.freeze({
  Agentic: "var(--series-1)",
  "SWE-Bench": "var(--series-8)",
});
/** `SCOPE_COLOURS` as a Map, as a chart's colour scale and a legend take colours. */
export const SCOPE_COLOUR_MAP = new Map(Object.entries(SCOPE_COLOURS));

/** The six gap-bin colours, shortest gap first: one blue from light to dark. */
export const GAP_BIN_SLOTS = Object.freeze([
  "var(--gap-bin-1)",
  "var(--gap-bin-2)",
  "var(--gap-bin-3)",
  "var(--gap-bin-4)",
  "var(--gap-bin-5)",
  "var(--gap-bin-6)",
]);

/**
 * A map from each distinct name, in the given order, to its series colour, the first taking the slot `firstSlot` (0,
 * the first, by default) and the next ones the slots after it, round to the first; the ninth and beyond to
 * `OTHER_SERIES`.
 */
export function assignColours(names, firstSlot = 0) {
  const colours = new Map();
  for (const name of names) {
    if (colours.has(name)) {
      continue;
    }
    const slot = (firstSlot + colours.size) % SERIES_SLOTS.length;
    colours.set(name, colours.size < SERIES_SLOTS.length ? SERIES_SLOTS[slot] : OTHER_SERIES);
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

/**
 * A bar chart's colours: the first eight of `names` in their series colours from the slot `firstSlot` (as
 * `assignColours` gives them), and "Other", which the rest fold into.
 */
export function barColours(names, firstSlot = 0) {
  const colours = assignColours(names.slice(0, SERIES_SLOTS.length), firstSlot);
  colours.set(OTHER_NAME, OTHER_SERIES);
  return colours;
}

/** A map from each tool category of `categories`, in their order but with the category Other last, to its colour. */
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

/**
 * The colour of the tool category `category` (`TOOL_CATEGORY_COLOURS`); a category the release does not name, which
 * has no colour yet, the Other grey.
 */
export function toolCategoryColour(category) {
  return TOOL_CATEGORY_COLOURS[category] ?? OTHER_SERIES;
}

/**
 * The colours every figure shares, `{ models, categories, providers }`, each a Map from name to colour, from the colour
 * orders, which cover every week and harness: a tool category in its own colour, the category Other last.
 */
export async function figureColours(orders) {
  const models = await orders.models;
  const categories = await orders.categories;
  const providers = await orders.providers;
  return Object.freeze({
    models: assignColours(models.map((row) => row.model)),
    categories: toolCategoryColours(categories.map((row) => row.category)),
    providers: assignColours(providers.map((row) => row.provider)),
  });
}
