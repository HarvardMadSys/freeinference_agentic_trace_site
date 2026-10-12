/**
 * The Session page's facts card: what kind of session it is, when it ran, how much it did and how much it cached, as
 * labelled fields in two columns.
 *
 * Turns, requests and tool calls are the top-level session's own, with its subagents' given apart; token totals
 * cover every agent of the tree, and the cached share is their cached tokens over their cache-reporting input.
 * `tree` holds rows of `session/session_tree` (the top-level session has depth 0) and `requests` rows of
 * `session/session_requests`.
 */

import {
  cachedShare, formatCount, formatOptionalShare, formatSeconds, formatTokens, utcMinute,
} from "../shared/format.js";

/**
 * The card's fields, in order: `[{ label, value, detail }]`. `value` is a string, or for the models a list of lines
 * `[{ text, note }]`, a model's name and its requests; `detail` adds a number in a smaller type, or is empty.
 */
export function sessionFacts(tree, requests) {
  const topLevel = tree.find((session) => session.depth === 0);
  const totals = treeTotals(tree);
  const subagentTurns = totals.turns - topLevel.user_steps;
  const subagentToolCalls = totals.toolCalls - topLevel.tool_calls;
  return [
    { label: "Harness", value: topLevel.harness, detail: "" },
    { label: "Models", value: modelLines(requests), detail: "" },
    { label: "Started", value: `${utcMinute(topLevel.first_start_ms)} UTC`, detail: "" },
    { label: "Duration", value: formatSeconds(topLevel.duration_s), detail: "" },
    { label: "Turns", value: formatCount(topLevel.user_steps), detail: inSubagents(subagentTurns) },
    { label: "Requests", value: formatCount(topLevel.requests), detail: inSubagents(topLevel.subagent_requests) },
    { label: "Subagents", value: formatCount(topLevel.subagents), detail: "" },
    { label: "Tool calls", value: formatCount(topLevel.tool_calls), detail: inSubagents(subagentToolCalls) },
    { label: "Input tokens", value: formatTokens(totals.inputTokens), detail: "" },
    { label: "Cached share", value: treeCachedShare(totals), detail: `${formatTokens(totals.cachedTokens)} cached` },
    { label: "Output tokens", value: formatTokens(totals.outputTokens), detail: "" },
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

// A field: its label, then its value, a line per entry when it has several, and its detail.
function factField({ label, value, detail }) {
  const field = document.createElement("div");
  field.className = "fact";
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

// One line of a field of several lines: its text, then its note in a smaller, muted type.
function factLine({ text, note }) {
  const line = textSpan("fact-line", `${text} `);
  line.append(textSpan("fact-detail", note));
  return line;
}

// A model per line, its name and its requests: "glm-5.3-flash 4,073".
function modelLines(requests) {
  return requestsPerModel(requests).map((entry) => ({ text: entry.model, note: formatCount(entry.requests) }));
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
