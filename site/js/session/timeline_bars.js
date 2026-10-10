/**
 * The Timeline view's Gantt rows and bars: one row per agent, and on it, against time since the top-level session's
 * first request, each request split into time to first token and the rest, each tool call from its request's end
 * for its latency, and each wait before a request, coloured by what it waited for.
 *
 * `tree` holds rows of `session/session_tree`, `requests` of `session/session_requests`, `toolCalls` of
 * `session/session_tool_calls`. A tool call's start is not in the data; it is taken as its request's end.
 */

import { agentLabel, agentsInStartOrder, callsByRequest, requestKey } from "./tree.js";
import { elapsedSeconds } from "./view_chart.js";
import { assignColours, OTHER_SERIES } from "../shared/charts.js";
import { formatSeconds } from "../shared/format.js";

/** What a wait can wait for, in the order that gives each its colour, with the name a legend and tooltip give it. */
export const WAIT_CAUSES = Object.freeze({
  user: "the user",
  tool: "tools",
  subagent: "subagents",
  ask_user_tool: "an ask-user tool",
});

/**
 * The colour of each part of a request's bar: time to first token, the rest, and a request with no TTFT as one bar.
 * They are ink tones, not series colours, so that on the timeline a colour always means a tool category or a wait.
 */
export const REQUEST_PART_COLOURS = Object.freeze({
  ttft: "var(--color-text-muted)",
  decode: "var(--color-text-faint)",
  whole: "var(--color-text-faint)",
});

/** The opacity of a wait's bar: lighter than a request's, since nothing ran. */
export const WAIT_OPACITY = 0.35;

/** Where each band sits in its row, as shares of the row from its top: requests and waits, then tool calls below. */
export const BAND_SPANS = Object.freeze({ request: [0.12, 0.6], tool: [0.66, 0.88] });

// The share of a row from its top where the pointer passes from the request band to the tool band: between the two.
const BAND_BOUNDARY = 0.63;

const MILLISECONDS_PER_SECOND = 1000;

/** A map from each wait cause to its colour, in the order of `WAIT_CAUSES`. */
export function waitColours() {
  return assignColours(Object.keys(WAIT_CAUSES));
}

/** The Gantt's rows, `[{ sessionId, label }]`: the top-level session, then every subagent in order of first start. */
export function ganttRows(tree) {
  return agentsInStartOrder(tree).map((session) => ({ sessionId: session.session_id, label: agentLabel(session) }));
}

/**
 * Every bar of the Gantt: `{ sessionId, step, row, band, x1, x2, colour, opacity, tip }`, `row` the index of its
 * agent's row, `band` "request" (requests and waits) or "tool" (tool calls, drawn thinner below), `x1` and `x2` in
 * seconds since the top-level session's first request, and `step` the request a click opens: for a wait, the request
 * it came before. `categoryColours` maps each tool category to its colour. Waits under zero and tool calls without a
 * positive latency have no bar.
 */
export function ganttBars(tree, requests, toolCalls, categoryColours) {
  const agents = agentsInStartOrder(tree);
  const rowBySession = new Map(agents.map((session, index) => [session.session_id, index]));
  const labelBySession = new Map(agents.map((session) => [session.session_id, agentLabel(session)]));
  const calls = callsByRequest(toolCalls);
  const causeColours = waitColours();
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
    bars.push(...waitBars(request, place, causeColours));
    bars.push(...requestBars(request, place));
    for (const call of calls.get(requestKey(request.session_id, request.step)) ?? []) {
      bars.push(...toolBars(call, request, place, categoryColours));
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
function waitBars(request, place, causeColours) {
  if (request.waited_for === null || request.wait_s === null || request.wait_s <= 0) {
    return [];
  }
  const start = elapsedSeconds(request.start_ms, place.originMs);
  const cause = WAIT_CAUSES[request.waited_for] ?? request.waited_for;
  const tip = `waited ${formatSeconds(request.wait_s)} for ${cause}\nbefore ${place.label} step ${place.step}`;
  const colour = causeColours.get(request.waited_for) ?? OTHER_SERIES;
  return [{ ...bar(place, "request", start - request.wait_s, start, colour, tip), opacity: WAIT_OPACITY }];
}

/** A tool call's bar, from its request's end for its latency; none without a positive latency. */
function toolBars(call, request, place, categoryColours) {
  if (!hasLatency(call)) {
    return [];
  }
  const start = elapsedSeconds(request.end_ms, place.originMs);
  const end = start + call.latency_ms / MILLISECONDS_PER_SECOND;
  const latency = `latency ${formatSeconds(end - start)}`;
  const tip = `${call.name} · ${call.category}\n${latency}\nafter ${place.label} step ${place.step}`;
  return [bar(place, "tool", start, end, categoryColours.get(call.category) ?? OTHER_SERIES, tip)];
}

/** `bar` with `y1` and `y2`, the top and bottom of its band in its agent's row, row 0 spanning 0 to 1. */
export function placedInRow(bar) {
  const [top, bottom] = BAND_SPANS[bar.band];
  return { ...bar, y1: bar.row + top, y2: bar.row + bottom };
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
 * The legend entries of a request's parts, `[{ name, colour }]`: time to first token and the rest, the rest naming
 * the whole request with no TTFT when `requests` has one, since both are drawn in the same tone.
 */
export function requestPartEntries(requests) {
  const hasUnreported = requests.some((request) => request.ttft_ms === null);
  const rest = hasUnreported ? "rest of the request, or all of one with no time to first token" : "rest of the request";
  return [
    { name: "time to first token", colour: REQUEST_PART_COLOURS.ttft },
    { name: rest, colour: REQUEST_PART_COLOURS.decode },
  ];
}

/** The legend entries of the waits `requests` has, `[{ name, colour, opacity }]`, in the order of `WAIT_CAUSES`. */
export function waitEntries(requests) {
  const colours = waitColours();
  const entries = [];
  for (const [cause, name] of Object.entries(WAIT_CAUSES)) {
    if (requests.some((request) => request.waited_for === cause)) {
      entries.push({ name, colour: colours.get(cause), opacity: WAIT_OPACITY });
    }
  }
  return entries;
}

function hasLatency(call) {
  return call.latency_ms !== null && call.latency_ms > 0;
}

function bar(place, band, x1, x2, colour, tip) {
  return { sessionId: place.sessionId, step: place.step, row: place.row, band, x1, x2, colour, opacity: 1, tip };
}
