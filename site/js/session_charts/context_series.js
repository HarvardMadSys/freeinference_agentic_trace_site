/**
 * The Context view's series: each request as a point at its start, time measured from the top-level session's first
 * request; each agent's input over time; the top-level session's input split into cached and uncached tokens (as
 * `tokenParts` counts them) or by role; the start of each turn; and the requests whose transition rewrote or switched
 * the context.
 *
 * `tree` holds rows of `buckets/week_tree`, `requests` rows of `buckets/week_requests`.
 */

import { INPUT_ROLES, TOKEN_PART_NAMES, tokenParts } from "../session/token_parts.js";
import { agentLabel, agentsInStartOrder, byStart, groupedBy, topLevelSession } from "../session/tree.js";
import { ROLE_COLOURS, SERIES_SLOTS, TOKEN_PART_COLOURS, TRANSITION_COLOURS, VIOLET_SLOT } from "../theme/colours.js";
import { elapsedSeconds, formatCompactCount, formatElapsed } from "../shared/format.js";

/** The two ways the area can split the top-level session's input: into cached and uncached tokens, or by role. */
export const AREA_SPLITS = Object.freeze({ tokens: "Cached and uncached", roles: "By role" });

/**
 * The colour of each agent's line: the top-level session's, and every subagent's. The subagents' slot is one the
 * token split of the area does not use; in the role split it is also the system role's, a line against an area.
 */
export const AGENT_LINE_COLOURS = Object.freeze({ main: SERIES_SLOTS[0], subagents: VIOLET_SLOT });

/**
 * The transitions a dot marks, each with the dot's colour: the context was rewritten, in the colour every chart gives a
 * mutation, or the request went to another model or provider, in the text ink, which stands out on every area, since
 * no figure draws a switch.
 */
export const MARK_COLOURS = Object.freeze({ mutation: TRANSITION_COLOURS.mutation, switch: "var(--color-text)" });
const MIN_TURN_GAP_PIXELS = 3; // a turn's rule is drawn only this far from the last one drawn, or further

// Each transition a dot marks, as the legend names it.
const MARK_NAMES = Object.freeze({ mutation: "Mutation", switch: "Model or provider switch" });

/**
 * One point per request of every agent, in agent order and then start order: `{ sessionId, step, turn, label,
 * isTopLevel, elapsed, inputTokens, cachedTokens, uncachedTokens, transition, cause }`, `elapsed` in seconds since
 * the top-level session's first request.
 */
export function requestPoints(tree, requests) {
  const originMs = topLevelSession(tree).first_start_ms;
  const points = [];
  for (const session of agentsInStartOrder(tree)) {
    for (const request of requestsOf(session, requests)) {
      const tokens = tokenParts(request);
      points.push({
        sessionId: session.session_id,
        step: request.step,
        turn: request.turn,
        label: agentLabel(session),
        isTopLevel: session.parent_session_id === null,
        elapsed: elapsedSeconds(request.start_ms, originMs),
        inputTokens: request.prompt_tokens,
        cachedTokens: tokens.cached,
        uncachedTokens: tokens.uncached,
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
  const originMs = topLevelSession(tree).first_start_ms;
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
 * uncached input, or the five roles.
 */
export function areaParts(split) {
  if (split === "roles") {
    return INPUT_ROLES.map((role) => ({ name: role.name, colour: ROLE_COLOURS[role.role] }));
  }
  return [
    { name: TOKEN_PART_NAMES.cached, colour: TOKEN_PART_COLOURS.cached },
    { name: TOKEN_PART_NAMES.uncached, colour: TOKEN_PART_COLOURS.uncached },
  ];
}

/**
 * The rows of the top-level session's stacked area for `split`: `{ elapsed, part, tokens }` for each part at each
 * request's start, and at the last request's end, so that the last request has a width.
 */
export function areaRows(tree, requests, split) {
  const topLevel = topLevelSession(tree);
  const ownRequests = requestsOf(topLevel, requests);
  const parts = areaParts(split);
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

/**
 * The points of step-after series cut to the time `range`, `{ start, end }`: for each series (the points sharing
 * `point[seriesKey]`, in time order), its points inside the range, a point at the range's start holding the value it
 * had there, and one at the range's end holding the value it had just before; a series wholly outside has none.
 */
export function stepsWithin(points, seriesKey, range) {
  const cut = [];
  for (const seriesPoints of groupedBy(points, seriesKey).values()) {
    cut.push(...seriesWithin(seriesPoints, range));
  }
  return cut;
}

/** The elapsed seconds at the first request of each turn of the top-level session. */
export function turnStarts(tree, requests) {
  const topLevel = topLevelSession(tree);
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
  return points.filter((point) => isMarked(point.transition));
}

/** The legend entries `[{ name, colour }]` of the transitions `marks` holds, in the order of `MARK_COLOURS`. */
export function markEntries(marks) {
  const entries = [];
  for (const [transition, colour] of Object.entries(MARK_COLOURS)) {
    if (marks.some((point) => point.transition === transition)) {
      entries.push({ name: MARK_NAMES[transition], colour });
    }
  }
  return entries;
}

/** A point's tooltip: its agent, step and turn, its time, its input tokens and, when marked, its transition. */
export function pointTip(point) {
  const cached = formatCompactCount(point.cachedTokens);
  const uncached = formatCompactCount(point.uncachedTokens);
  const lines = [
    `${point.label} · step ${point.step} · turn ${point.turn}`,
    formatElapsed(point.elapsed),
    `${formatCompactCount(point.inputTokens)} input tokens: ${cached} cached, ${uncached} uncached`,
  ];
  if (isMarked(point.transition)) {
    const cause = point.cause === null ? "" : `, ${point.cause}`;
    lines.push(`transition: ${point.transition}${cause}`);
  }
  return lines.join("\n");
}

function isMarked(transition) {
  return transition !== null && Object.hasOwn(MARK_COLOURS, transition);
}

// One series's points, in time order, cut to `range` as `stepsWithin` says.
function seriesWithin(points, range) {
  if (points.at(-1).elapsed <= range.start || points[0].elapsed >= range.end) {
    return [];
  }
  const cut = [];
  const atStart = points.filter((point) => point.elapsed <= range.start).at(-1);
  if (atStart !== undefined) {
    cut.push({ ...atStart, elapsed: range.start });
  }
  cut.push(...points.filter((point) => point.elapsed > range.start && point.elapsed < range.end));
  if (points.at(-1).elapsed >= range.end) {
    cut.push({ ...points.filter((point) => point.elapsed < range.end).at(-1), elapsed: range.end });
  }
  return cut;
}

function partRows(elapsed, tokens, parts) {
  return parts.map((part) => ({ elapsed, part: part.name, tokens: tokens[part.name] }));
}

/** The tokens of each part of `request`'s input for `split`, by part name. */
function partTokens(request, split) {
  if (split === "roles") {
    const tokens = {};
    for (const role of INPUT_ROLES) {
      tokens[role.name] = request[role.column];
    }
    return tokens;
  }
  const tokens = tokenParts(request);
  return { [TOKEN_PART_NAMES.cached]: tokens.cached, [TOKEN_PART_NAMES.uncached]: tokens.uncached };
}

/** The requests of `session` in start order, the step breaking a tie. */
function requestsOf(session, requests) {
  const ownRequests = requests.filter((request) => request.session_id === session.session_id);
  return ownRequests.sort(byStart);
}

/**
 * The turn starts of `starts` (seconds) within `range` that a chart `width` pixels wide marks: each at least
 * `MIN_TURN_GAP_PIXELS` from the last one marked, so dense starts do not draw a hatched block.
 */
export function spacedStarts(starts, range, width) {
  const secondsPerPixel = (range.end - range.start) / width;
  const marked = [];
  for (const start of starts) {
    const isInRange = start >= range.start && start <= range.end;
    if (isInRange && (marked.length === 0 || start - marked.at(-1) >= MIN_TURN_GAP_PIXELS * secondsPerPixel)) {
      marked.push(start);
    }
  }
  return marked;
}
