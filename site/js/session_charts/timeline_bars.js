/**
 * The Timeline view's Gantt rows and bars: one row per agent, and on it, against time since the top-level session's
 * first request, each request split into time to first token and the rest in the prefill and decode colours, each tool
 * call from its request's end for its latency in the tool part's green, and each wait before a request as a pale tint:
 * a wait for a tool or the user of the part of the session's time it counts toward, and a wait for subagents, which
 * counts as tool time, of violet, so that it is told apart from a wait for a tool.
 *
 * `tree` holds rows of `session/session_tree`, `requests` of `session/session_requests`, `toolCalls` of
 * `session/session_tool_calls`. A tool call's start is not in the data; it is taken as its request's end.
 */

import { agentLabel, agentsInStartOrder, callsByRequest, requestKey } from "../session/tree.js";
import {
  OTHER_SERIES, REQUEST_PART_COLOURS, TIMELINE_TOOL_CALL_COLOUR, TIMELINE_WAIT_COLOURS,
} from "../theme/colours.js";
import { elapsedSeconds, formatSeconds, MILLISECONDS_PER_SECOND } from "../shared/format.js";

/**
 * What a wait can wait for, in the order the paper names the causes, with the words a tooltip gives it ("waited 2 s
 * for tools"); the keys are the release's `waited_for` values, checked by tests/test_pipeline_mirrors.py and, for
 * their order, tests/test_pipeline_mirrors_caching.py.
 */
export const WAIT_CAUSES = Object.freeze({
  tool: "tools",
  ask_user_tool: "an ask-user tool",
  user: "the user",
  subagent: "subagents",
});

// The legend's entries of the waits, each the causes it draws in one colour: a wait for a tool and the user's named as
// the parts of a session's time they count toward, and a wait for subagents, which counts as tool time, on its own.
const WAIT_LEGEND = Object.freeze([
  Object.freeze({ name: "Tool wait", causes: Object.freeze(["tool"]) }),
  Object.freeze({ name: "User idle", causes: Object.freeze(["user", "ask_user_tool"]) }),
  Object.freeze({ name: "Subagent wait", causes: Object.freeze(["subagent"]) }),
]);

/** Where each band sits in its row, as shares of the row from its top: requests and waits, then tool calls below. */
export const BAND_SPANS = Object.freeze({ request: [0.12, 0.6], tool: [0.66, 0.88] });

// The share of a row from its top where the pointer passes from the request band to the tool band: between the two.
const BAND_BOUNDARY = 0.63;

/**
 * The Gantt's rows, `[{ sessionId, label, shortLabel }]`: the top-level session, then every subagent in order of first
 * start; `shortLabel`, for a narrow chart, numbers the subagents in that order, "Sub 1", "Sub 2".
 */
export function ganttRows(tree) {
  const rows = [];
  for (const session of agentsInStartOrder(tree)) {
    const shortLabel = rows.length === 0 ? agentLabel(session) : `Sub ${rows.length}`;
    rows.push({ sessionId: session.session_id, label: agentLabel(session), shortLabel });
  }
  return rows;
}

/**
 * Every bar of the Gantt: `{ sessionId, step, row, band, x1, x2, colour, isWait, tip }`, `row` the index of its
 * agent's row, `band` "request" (requests and waits) or "tool" (tool calls, drawn thinner below), `x1` and `x2` in
 * seconds since the top-level session's first request, and `step` the request a click opens: for a wait, the request
 * it came before. Waits under zero and tool calls without a positive latency have no bar.
 */
export function ganttBars(tree, requests, toolCalls) {
  const agents = agentsInStartOrder(tree);
  const rowBySession = new Map(agents.map((session, index) => [session.session_id, index]));
  const labelBySession = new Map(agents.map((session) => [session.session_id, agentLabel(session)]));
  const calls = callsByRequest(toolCalls);
  const originMs = agents[0].first_start_ms;
  const bars = [];
  for (const request of requests) {
    const place = {
      sessionId: request.session_id,
      step: request.step,
      row: rowBySession.get(request.session_id),
      label: labelBySession.get(request.session_id),
      originMs,
    };
    bars.push(...waitBars(request, place));
    bars.push(...requestBars(request, place));
    for (const call of calls.get(requestKey(request.session_id, request.step)) ?? []) {
      bars.push(...toolBars(call, request, place));
    }
  }
  return bars;
}

/** `{ toolCalls, waits }`: how many tool calls lack a positive latency and how many waits are under zero, undrawn. */
export function undrawnCounts(requests, toolCalls) {
  const toolCount = toolCalls.filter((call) => !hasLatency(call)).length;
  const waitCount = requests.filter((request) => request.wait_s !== null && request.wait_s < 0).length;
  return { toolCalls: toolCount, waits: waitCount };
}

/** A request's bars: time to first token, then the rest; or one bar when no TTFT was reported. */
function requestBars(request, place) {
  const start = elapsedSeconds(request.start_ms, place.originMs);
  const end = elapsedSeconds(request.end_ms, place.originMs);
  const heading = `${place.label} · step ${place.step} · turn ${request.turn}`;
  if (request.ttft_ms === null) {
    const tip = `${heading}\nrequest ${formatSeconds(end - start)}, no time to first token reported`;
    return [bar(place, "request", start, end, REQUEST_PART_COLOURS.whole, tip)];
  }
  const firstToken = Math.min(start + request.ttft_ms / MILLISECONDS_PER_SECOND, end);
  const durations = `time to first token ${formatSeconds(firstToken - start)}\nrest ${formatSeconds(end - firstToken)}`;
  const tip = `${heading}\n${durations}`;
  const parts = [
    bar(place, "request", start, firstToken, REQUEST_PART_COLOURS.ttft, tip),
    bar(place, "request", firstToken, end, REQUEST_PART_COLOURS.decode, tip),
  ];
  return parts.filter((part) => part.x2 > part.x1);
}

/** The wait before a request, ending at its start and lasting `wait_s`; none for a first request or a wait under 0. */
function waitBars(request, place) {
  if (request.waited_for === null || request.wait_s === null || request.wait_s <= 0) {
    return [];
  }
  const start = elapsedSeconds(request.start_ms, place.originMs);
  const cause = WAIT_CAUSES[request.waited_for] ?? request.waited_for;
  const tip = `waited ${formatSeconds(request.wait_s)} for ${cause}\nbefore ${place.label} step ${place.step}`;
  const colour = TIMELINE_WAIT_COLOURS[request.waited_for] ?? OTHER_SERIES;
  return [{ ...bar(place, "request", start - request.wait_s, start, colour, tip), isWait: true }];
}

/** A tool call's bar, from its request's end for its latency; none without a positive latency. */
function toolBars(call, request, place) {
  if (!hasLatency(call)) {
    return [];
  }
  const start = elapsedSeconds(request.end_ms, place.originMs);
  const end = start + call.latency_ms / MILLISECONDS_PER_SECOND;
  const latency = `latency ${formatSeconds(end - start)}`;
  const tip = `${call.name} · ${call.category}\n${latency}\nafter ${place.label} step ${place.step}`;
  return [bar(place, "tool", start, end, TIMELINE_TOOL_CALL_COLOUR, tip)];
}

/** `bar` with `y1` and `y2`, the top and bottom of its band in its agent's row, row 0 spanning 0 to 1. */
export function placedInRow(bar) {
  const [top, bottom] = BAND_SPANS[bar.band];
  return { ...bar, y1: bar.row + top, y2: bar.row + bottom };
}

/** The bars of `bars` that overlap the time `range`, `{ start, end }` in seconds, each cut at the range's edges. */
export function barsWithin(bars, range) {
  const shown = [];
  for (const bar of bars) {
    if (bar.x2 > range.start && bar.x1 < range.end) {
      shown.push({ ...bar, x1: Math.max(bar.x1, range.start), x2: Math.min(bar.x2, range.end) });
    }
  }
  return shown;
}

/** `{ row, band }` under a pointer at `y` rows from the top: the upper part of a row is its request band. */
export function pointerPlace(y) {
  const row = Math.floor(y);
  return { row, band: y - row < BAND_BOUNDARY ? "request" : "tool" };
}

/**
 * The bar under a pointer at `x` seconds in `row` and `band`: the last drawn of the bars there whose span holds x,
 * which is the one on top; otherwise the nearest within `toleranceSeconds`, so a bar under a pixel wide can still be
 * pointed at; otherwise null.
 */
export function barAt(bars, { x, row, band, toleranceSeconds }) {
  let holding = null;
  let nearest = null;
  let nearestDistance = toleranceSeconds;
  for (const bar of bars) {
    if (bar.row !== row || bar.band !== band) {
      continue;
    }
    if (bar.x1 <= x && x < bar.x2) {
      holding = bar;
      continue;
    }
    const distance = Math.max(bar.x1 - x, x - bar.x2);
    if (distance <= nearestDistance) {
      nearest = bar;
      nearestDistance = distance;
    }
  }
  return holding ?? nearest;
}

/**
 * The legend entries of a request's parts, `[{ name, colour }]`: prefill (time to first token) and decode (the rest),
 * and, when `requests` has a request with no TTFT, that whole request in the faint ink.
 */
export function requestPartEntries(requests) {
  const entries = [
    { name: "Prefill (time to first token)", colour: REQUEST_PART_COLOURS.ttft },
    { name: "Decode (the rest)", colour: REQUEST_PART_COLOURS.decode },
  ];
  if (requests.some((request) => request.ttft_ms === null)) {
    entries.push({ name: "No time to first token", colour: REQUEST_PART_COLOURS.whole });
  }
  return entries;
}

/** The legend entry of a tool call, in the tool part's green: `{ name, colour }`. */
export function toolCallEntry() {
  return { name: "Tool call", colour: TIMELINE_TOOL_CALL_COLOUR };
}

/** The legend entries of the waits `requests` has, `[{ name, colour }]`, in the order of `WAIT_LEGEND`. */
export function waitEntries(requests) {
  const entries = [];
  for (const { name, causes } of WAIT_LEGEND) {
    if (requests.some((request) => causes.includes(request.waited_for))) {
      entries.push({ name, colour: TIMELINE_WAIT_COLOURS[causes[0]] });
    }
  }
  return entries;
}

function hasLatency(call) {
  return call.latency_ms !== null && call.latency_ms > 0;
}

function bar(place, band, x1, x2, colour, tip) {
  return { sessionId: place.sessionId, step: place.step, row: place.row, band, x1, x2, colour, isWait: false, tip };
}
