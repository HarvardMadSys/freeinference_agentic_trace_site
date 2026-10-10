/**
 * The Context view's series: each request as a point at its start, time measured from the top-level session's first
 * request; each agent's input over time; the top-level session's input split into cached and uncached tokens or by
 * role; the start of each turn; and the requests whose transition rewrote or switched the context.
 *
 * `tree` holds rows of `session/session_tree`, `requests` rows of `session/session_requests`.
 */

import { agentLabel, agentsInStartOrder } from "./tree.js";
import { assignColours, OTHER_SERIES, SERIES_SLOTS, TOKEN_PART_COLOURS } from "../shared/charts.js";
import { elapsedSeconds, formatElapsed, formatTokens } from "../shared/format.js";

/** The two ways the area can split the top-level session's input: into cached and uncached tokens, or by role. */
export const AREA_SPLITS = Object.freeze({ tokens: "Cached and uncached", roles: "By role" });

/**
 * The colour of each agent's line: the top-level session's, and every subagent's. The subagents' slot is one neither
 * split of the area uses, so a subagent's line never reads as a part of the top-level session's input.
 */
export const AGENT_LINE_COLOURS = Object.freeze({ main: SERIES_SLOTS[0], subagents: SERIES_SLOTS[6] });

// The transitions a marker points out: the context was rewritten, or the request went to another model.
const MARKED_TRANSITIONS = Object.freeze(["mutation", "switch"]);

// Each role of the input, in stacking order, with the request column that counts its tokens.
const ROLE_COLUMNS = Object.freeze({
  system: "system_tokens",
  user: "user_tokens",
  assistant: "assistant_tokens",
  "tool results": "tool_tokens",
  "tool definitions": "tool_definition_tokens",
});

const NO_CACHE_REPORT = "input, no cache report";

/**
 * One point per request of every agent, in agent order and then start order: `{ sessionId, step, turn, label,
 * isTopLevel, elapsed, inputTokens, cachedTokens, uncachedTokens, transition, cause }`, `elapsed` in seconds since
 * the top-level session's first request.
 */
export function requestPoints(tree, requests) {
  const originMs = topLevelOf(tree).first_start_ms;
  const points = [];
  for (const session of agentsInStartOrder(tree)) {
    for (const request of requestsOf(session, requests)) {
      points.push({
        sessionId: session.session_id,
        step: request.step,
        turn: request.turn,
        label: agentLabel(session),
        isTopLevel: session.parent_session_id === null,
        elapsed: elapsedSeconds(request.start_ms, originMs),
        inputTokens: request.prompt_tokens,
        cachedTokens: request.cache_read_tokens,
        uncachedTokens: request.uncached_tokens,
        transition: request.transition,
        cause: request.cause,
      });
    }
  }
  return points;
}

/**
 * Each agent's input over time, `[{ sessionId, isTopLevel, elapsed, inputTokens }]`: a point at each request's start,
 * and one more at its last request's end, so that the last request, and an agent of one request, has a width.
 */
export function trajectoryPoints(tree, requests) {
  const originMs = topLevelOf(tree).first_start_ms;
  const points = [];
  for (const session of agentsInStartOrder(tree)) {
    const ownRequests = requestsOf(session, requests);
    if (ownRequests.length === 0) {
      continue;
    }
    const isTopLevel = session.parent_session_id === null;
    for (const request of ownRequests) {
      const elapsed = elapsedSeconds(request.start_ms, originMs);
      points.push({ sessionId: session.session_id, isTopLevel, elapsed, inputTokens: request.prompt_tokens });
    }
    const last = ownRequests.at(-1);
    const end = elapsedSeconds(last.end_ms, originMs);
    points.push({ sessionId: session.session_id, isTopLevel, elapsed: end, inputTokens: last.prompt_tokens });
  }
  return points;
}

/**
 * The parts the area stacks for `split` (a key of `AREA_SPLITS`), bottom up, as `[{ name, colour }]`: cached and
 * uncached input, plus the whole input of requests with no cache report when the top-level session has one; or the
 * five roles.
 */
export function areaParts(tree, requests, split) {
  if (split === "roles") {
    const colours = assignColours(Object.keys(ROLE_COLUMNS));
    return [...colours].map(([name, colour]) => ({ name, colour }));
  }
  const parts = [
    { name: "cached input", colour: TOKEN_PART_COLOURS.cached },
    { name: "uncached input", colour: TOKEN_PART_COLOURS.uncached },
  ];
  if (requestsOf(topLevelOf(tree), requests).some((request) => request.cache_read_tokens === null)) {
    parts.push({ name: NO_CACHE_REPORT, colour: OTHER_SERIES });
  }
  return parts;
}

/**
 * The rows of the top-level session's stacked area for `split`: `{ elapsed, part, tokens }` for each part at each
 * request's start, and at the last request's end, so that the last request has a width.
 */
export function areaRows(tree, requests, split) {
  const topLevel = topLevelOf(tree);
  const ownRequests = requestsOf(topLevel, requests);
  const parts = areaParts(tree, requests, split);
  const rows = [];
  for (const request of ownRequests) {
    const elapsed = elapsedSeconds(request.start_ms, topLevel.first_start_ms);
    rows.push(...partRows(elapsed, partTokens(request, split), parts));
  }
  const last = ownRequests.at(-1);
  const end = elapsedSeconds(last.end_ms, topLevel.first_start_ms);
  rows.push(...partRows(end, partTokens(last, split), parts));
  return rows;
}

/** The elapsed seconds at the first request of each turn of the top-level session. */
export function turnStarts(tree, requests) {
  const topLevel = topLevelOf(tree);
  const starts = [];
  const seenTurns = new Set();
  for (const request of requestsOf(topLevel, requests)) {
    if (!seenTurns.has(request.turn)) {
      seenTurns.add(request.turn);
      starts.push(elapsedSeconds(request.start_ms, topLevel.first_start_ms));
    }
  }
  return starts;
}

/** The points whose request's transition is a mutation or a switch. */
export function transitionMarks(points) {
  return points.filter((point) => MARKED_TRANSITIONS.includes(point.transition));
}

/** A point's tooltip: its agent, step and turn, its time, its input tokens and, when marked, its transition. */
export function pointTip(point) {
  const lines = [`${point.label} · step ${point.step} · turn ${point.turn}`, formatElapsed(point.elapsed)];
  if (point.cachedTokens === null) {
    lines.push(`${formatTokens(point.inputTokens)} input tokens, no cache report`);
  } else {
    const split = `${formatTokens(point.cachedTokens)} cached, ${formatTokens(point.uncachedTokens)} uncached`;
    lines.push(`${formatTokens(point.inputTokens)} input tokens: ${split}`);
  }
  if (MARKED_TRANSITIONS.includes(point.transition)) {
    const cause = point.cause === null ? "" : `, ${point.cause}`;
    lines.push(`transition: ${point.transition}${cause}`);
  }
  return lines.join("\n");
}

function partRows(elapsed, tokens, parts) {
  return parts.map((part) => ({ elapsed, part: part.name, tokens: tokens[part.name] }));
}

/** The tokens of each part of `request`'s input for `split`, by part name. */
function partTokens(request, split) {
  if (split === "roles") {
    const tokens = {};
    for (const [role, column] of Object.entries(ROLE_COLUMNS)) {
      tokens[role] = request[column];
    }
    return tokens;
  }
  if (request.cache_read_tokens === null) {
    return { "cached input": 0, "uncached input": 0, [NO_CACHE_REPORT]: request.prompt_tokens };
  }
  return { "cached input": request.cache_read_tokens, "uncached input": request.uncached_tokens, [NO_CACHE_REPORT]: 0 };
}

function topLevelOf(tree) {
  return tree.find((session) => session.parent_session_id === null);
}

/** The requests of `session` in start order, the step breaking a tie. */
function requestsOf(session, requests) {
  const ownRequests = requests.filter((request) => request.session_id === session.session_id);
  return ownRequests.sort((first, second) => first.start_ms - second.start_ms || first.step - second.step);
}
