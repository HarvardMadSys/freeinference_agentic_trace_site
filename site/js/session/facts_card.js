/**
 * The Session page's facts card: what kind of session it is, when it ran, how much it did and how much it cached, as
 * labelled fields in three columns, those with a line on the subagents side by side.
 *
 * Turns, requests and tool calls are the top-level session's own, with its subagents' given apart; token totals
 * cover every agent of the tree, and the cached share is their cached tokens over their cache-reporting input.
 * `tree` holds rows of `buckets/week_tree` and `requests` rows of `buckets/week_requests`.
 */

import {
  cachedShare, formatCompactCount, formatCount, formatOptionalShare, formatQuantity, formatSeconds, longMinute,
} from "../shared/format.js";
import { topLevelSession } from "./tree.js";

// The cached share's hover text: its definition, which differs from the drawn parts', where unreported input is
// uncached.
const CACHED_SHARE_DEFINITION = "cached tokens over the input of requests whose provider reports cache reads";

/**
 * The card's fields, in order: `[{ label, value, detail, definition }]`. `value` is a string, or for the models a list
 * of lines `[{ text, note }]`, a model's name and its requests; `detail` adds a number in a smaller type, or is empty;
 * `definition`, on the cached share alone, is the field's hover text.
 */
export function sessionFacts(tree, requests) {
  const topLevel = topLevelSession(tree);
  const totals = treeTotals(tree);
  const subagentTurns = totals.turns - topLevel.user_steps;
  const subagentToolCalls = totals.toolCalls - topLevel.tool_calls;
  // Three to a row: what and when; how long and how much, turns beside requests; the tokens; the subagents beside
  // the tool calls.
  return [
    { label: "Harness", value: topLevel.harness, detail: "" },
    { label: "Models", value: modelLines(requests), detail: "" },
    { label: "Started", value: longMinute(topLevel.first_start_ms), detail: "" },
    { label: "Duration", value: formatSeconds(topLevel.duration_s), detail: "" },
    { label: "Turns", value: formatCount(topLevel.user_steps), detail: inSubagents(subagentTurns) },
    { label: "Requests", value: formatCount(topLevel.requests), detail: inSubagents(topLevel.subagent_requests) },
    { label: "Input tokens", value: formatCompactCount(totals.inputTokens), detail: "" },
    {
      label: "Cached share (reported)",
      value: treeCachedShare(totals),
      detail: `${formatCompactCount(totals.cachedTokens)} cached`,
      definition: CACHED_SHARE_DEFINITION,
    },
    { label: "Output tokens", value: formatCompactCount(totals.outputTokens), detail: "" },
    { label: "Subagents", value: formatCount(topLevel.subagents), detail: "" },
    { label: "Tool calls", value: formatCount(topLevel.tool_calls), detail: inSubagents(subagentToolCalls) },
  ];
}

/** Each model of the requests with its number of requests, most requests first and by name on a tie. */
export function requestsPerModel(requests) {
  const counts = new Map();
  for (const request of requests) {
    counts.set(request.model, (counts.get(request.model) ?? 0) + 1);
  }
  const models = [...counts.keys()].sort((first, second) => first.localeCompare(second));
  models.sort((first, second) => counts.get(second) - counts.get(first));
  return models.map((model) => ({ model, requests: counts.get(model) }));
}

/**
 * The facts card's list of `facts` (as `sessionFacts` gives them): a definition list of one field per fact, its label
 * then its value and detail.
 */
export function factsList(facts) {
  const list = document.createElement("dl");
  list.className = "facts";
  for (const fact of facts) {
    list.append(factField(fact));
  }
  return list;
}

// A field: its label, then its value, a line per entry when it has several, and its detail; its definition on hover.
function factField({ label, value, detail, definition }) {
  const field = document.createElement("div");
  field.className = "fact";
  if (definition !== undefined) {
    field.title = definition;
  }
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  if (Array.isArray(value)) {
    description.append(...value.map(factLine));
  } else {
    description.append(value);
  }
  if (detail !== "") {
    description.append(textSpan("fact-detail", detail));
  }
  field.append(term, description);
  return field;
}

// One line of a field of several lines: its text, which never breaks, then its note in a smaller, muted type.
function factLine({ text, note }) {
  const line = document.createElement("span");
  line.className = "fact-line";
  line.append(textSpan("fact-name", text), " ", textSpan("fact-detail", note));
  return line;
}

// A model per line, its name and its requests, the first naming its unit: "glm-5.3-flash 4,073 requests", "glm-5.2 12".
function modelLines(requests) {
  const lines = [];
  for (const entry of requestsPerModel(requests)) {
    let note = formatCount(entry.requests);
    if (lines.length === 0) {
      note = formatQuantity(entry.requests, "request", "requests");
    }
    lines.push({ text: entry.model, note });
  }
  return lines;
}

function treeTotals(tree) {
  const totals = { turns: 0, toolCalls: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, reportedInputTokens: 0 };
  for (const session of tree) {
    totals.turns += session.user_steps;
    totals.toolCalls += session.tool_calls;
    totals.inputTokens += session.input_tokens;
    totals.cachedTokens += session.cached_tokens;
    totals.outputTokens += session.output_tokens;
    totals.reportedInputTokens += session.reported_input_tokens;
  }
  return totals;
}

// The tree's cached share as the card writes it; "—" when no agent's provider reported cache reads.
function treeCachedShare(totals) {
  return formatOptionalShare(cachedShare(totals.cachedTokens, totals.reportedInputTokens));
}

function inSubagents(count) {
  return count > 0 ? `+ ${formatCount(count)} in subagents` : "";
}

function textSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
