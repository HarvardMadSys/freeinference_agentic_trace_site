/**
 * The Session page's stat strip: what kind of session it is, when it ran, how much it did and how much it cached.
 *
 * Turns, requests and tool calls are the top-level session's own, with its subagents' given apart; token totals
 * cover every agent of the tree, and the cached share is their cached tokens over their cache-reporting input.
 * `tree` holds rows of `session/session_tree` (the top-level session has depth 0) and `requests` rows of
 * `session/session_requests`.
 */

import {
  cachedShare, formatCount, formatOptionalShare, formatSeconds, formatTokens, utcMinute,
} from "../shared/format.js";

// The characters of a UTC minute, "YYYY-MM-DD HH:MM", that make its date; its time follows a space.
const DATE_LENGTH = "YYYY-MM-DD".length;

/**
 * The tiles of the stat strip, in order, as `statStrip` draws them: `[{ label, value, detail, isWide }]`, the first
 * three strings; a tile's detail line adds a number or names a part, and is empty where it would restate the label.
 * The Models tile is wide, so eleven tiles fill whole rows of four or of two.
 */
export function sessionFacts(tree, requests) {
  const topLevel = tree.find((session) => session.depth === 0);
  const totals = treeTotals(tree);
  const subagentTurns = totals.turns - topLevel.user_steps;
  const subagentToolCalls = totals.toolCalls - topLevel.tool_calls;
  const started = utcMinute(topLevel.first_start_ms);
  return [
    { label: "Harness", value: topLevel.harness, detail: "" },
    modelsFact(requests),
    { label: "Started", value: started.slice(0, DATE_LENGTH), detail: `${started.slice(DATE_LENGTH + 1)} UTC` },
    { label: "Duration", value: formatSeconds(topLevel.duration_s), detail: "" },
    { label: "Turns", value: formatCount(topLevel.user_steps), detail: inSubagents(subagentTurns) },
    { label: "Requests", value: formatCount(topLevel.requests), detail: inSubagents(topLevel.subagent_requests) },
    { label: "Subagents", value: formatCount(topLevel.subagents), detail: "" },
    { label: "Tool calls", value: formatCount(topLevel.tool_calls), detail: inSubagents(subagentToolCalls) },
    { label: "Input tokens", value: formatTokens(totals.inputTokens), detail: "" },
    { label: "Cached share", value: treeCachedShare(totals), detail: `${formatTokens(totals.cachedTokens)} cached tokens` },
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

// The Models tile: how many models, and one line per model with its requests, "glm-5.3-flash 4,073".
function modelsFact(requests) {
  const models = requestsPerModel(requests);
  const counted = models.map((entry) => `${entry.model} ${formatCount(entry.requests)}`);
  return { label: "Models", value: formatCount(models.length), detail: counted.join("\n"), isWide: true };
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

// The tree's cached share as the tile writes it; "—" when no agent's provider reported cache reads.
function treeCachedShare(totals) {
  return formatOptionalShare(cachedShare(totals.cachedTokens, totals.reportedInputTokens));
}

function inSubagents(count) {
  return count > 0 ? `+ ${formatCount(count)} in subagents` : "";
}
