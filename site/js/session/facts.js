/**
 * The Session page's stat strip: what kind of session it is, when it ran, how much it did and how much it cached.
 *
 * Turns, requests and tool calls are the top-level session's own, with its subagents' given apart; token totals
 * cover every agent of the tree, and the cached share is their cached tokens over their cache-reporting input. `tree` holds rows of `session/session_tree` (the top-level session has depth 0)
 * and `requests` rows of `session/session_requests`.
 */

import { formatCount, formatSeconds, formatShare, formatTokens } from "../shared/format.js";

// A cached share with no cache-reporting input is not a number; the tile shows this instead.
const NO_SHARE = "—";

// The characters of an ISO 8601 time that make up "YYYY-MM-DDTHH:MM".
const MINUTE_LENGTH = 16;

/** The tiles of the stat strip, in order: `[{ label, value, detail }]`, every value and detail a string. */
export function sessionFacts(tree, requests) {
  const topLevel = tree.find((session) => session.depth === 0);
  const totals = treeTotals(tree);
  return [
    { label: "Harness", value: topLevel.harness, detail: `${topLevel.scope} scope` },
    modelsFact(requests),
    { label: "Started", value: utcMinute(topLevel.first_start_ms), detail: "UTC" },
    { label: "Duration", value: formatSeconds(topLevel.duration_s), detail: "of the top-level session" },
    { label: "Turns", value: formatCount(topLevel.user_steps), detail: "of the top-level session" },
    { label: "Requests", value: formatCount(topLevel.requests), detail: inSubagents(topLevel.subagent_requests) },
    { label: "Subagents", value: formatCount(topLevel.subagents), detail: "at every depth" },
    { label: "Tool calls", value: formatCount(topLevel.tool_calls), detail: inSubagents(totals.toolCalls - topLevel.tool_calls) },
    { label: "Input tokens", value: formatTokens(totals.inputTokens), detail: "every agent" },
    { label: "Cached share", value: cachedShare(totals), detail: `${formatTokens(totals.cachedTokens)} cached tokens` },
    { label: "Output tokens", value: formatTokens(totals.outputTokens), detail: "every agent" },
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

/** A time in milliseconds since the epoch as its UTC minute: "2026-08-09 14:03". */
export function utcMinute(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, MINUTE_LENGTH).replace("T", " ");
}

/** Fill `container` with a stat strip of `facts`, one tile each. */
export function mountFacts(container, facts) {
  const strip = document.createElement("div");
  strip.className = "stat-strip";
  for (const fact of facts) {
    strip.append(factTile(fact));
  }
  container.replaceChildren(strip);
}

function factTile({ label, value, detail }) {
  const tile = document.createElement("div");
  tile.className = "stat";
  for (const [className, text] of [["stat-label", label], ["stat-value", value], ["stat-detail", detail]]) {
    const line = document.createElement("div");
    line.className = className;
    line.textContent = text;
    tile.append(line);
  }
  return tile;
}

function modelsFact(requests) {
  const models = requestsPerModel(requests);
  const counted = models.map((entry) => `${entry.model} · ${formatCount(entry.requests)}`);
  return { label: "Models", value: formatCount(models.length), detail: counted.join(", ") };
}

function treeTotals(tree) {
  const totals = { toolCalls: 0, inputTokens: 0, cachedTokens: 0, outputTokens: 0, reportedInputTokens: 0 };
  for (const session of tree) {
    totals.toolCalls += session.tool_calls;
    totals.inputTokens += session.input_tokens;
    totals.cachedTokens += session.cached_tokens;
    totals.outputTokens += session.output_tokens;
    totals.reportedInputTokens += session.reported_input_tokens;
  }
  return totals;
}

function cachedShare(totals) {
  if (totals.reportedInputTokens === 0) {
    return NO_SHARE;
  }
  return formatShare(totals.cachedTokens / totals.reportedInputTokens);
}

function inSubagents(count) {
  return count > 0 ? `+ ${formatCount(count)} in subagents` : "";
}
