/**
 * The brackets of the Requests view: the requests that ran at the same time, and one vertical bracket in the list's
 * left gutter per overlap group, joining their rows.
 *
 * A request runs over `[start_ms, end_ms)`, so one that starts the moment another ends does not overlap it. An
 * overlap group is a maximal set of requests linked by overlaps: each overlaps at least one other in the group, and
 * none overlaps a request outside it. Agents run side by side, so a group usually joins requests of several sessions.
 *
 * A request hidden in a collapsed subagent group is stood for by the header of the outermost collapsed group around
 * it, so two collapsed subagents that ran side by side are joined at their headers. Brackets that cross take
 * separate lanes of the gutter; a bracket that finds no free lane is not drawn, and the view says how many.
 */

import { SERIES_SLOTS } from "../theme/colours.js";

/** The number of lanes in the gutter: more brackets crossing one row than this are not drawn. */
export const MAX_LANES = 6;

// The width of one lane of the gutter, in rem; six lanes fill the list's left padding.
const LANE_WIDTH_REM = 0.4;

/**
 * The overlap groups of `requests`, each an array of indices into `requests` in start order, the groups in order of
 * their first start. A request that overlaps no other is in no group.
 */
export function overlapGroups(requests) {
  const startOrder = Array.from(requests.keys());
  startOrder.sort((first, second) => requests[first].start_ms - requests[second].start_ms);
  const groups = [];
  let group = [];
  let groupEnd = -Infinity; // the latest end of the requests in `group`
  for (const index of startOrder) {
    const request = requests[index];
    if (request.start_ms < groupEnd) {
      group.push(index);
      groupEnd = Math.max(groupEnd, request.end_ms);
    } else {
      addIfOverlapping(groups, group);
      group = [index];
      groupEnd = request.end_ms;
    }
  }
  addIfOverlapping(groups, group);
  return groups;
}

/**
 * The lane of each span, `{ top, bottom }`, sorted by `top`: the first lane whose last bracket ends above the span's
 * top, or null when all `laneCount` lanes are taken there.
 */
export function assignLanes(spans, laneCount) {
  const laneBottoms = []; // the bottom of the last bracket placed in each lane
  const lanes = [];
  for (const span of spans) {
    let lane = laneBottoms.findIndex((bottom) => bottom < span.top);
    if (lane === -1 && laneBottoms.length < laneCount) {
      lane = laneBottoms.length;
    }
    if (lane === -1) {
      lanes.push(null);
    } else {
      laneBottoms[lane] = span.bottom;
      lanes.push(lane);
    }
  }
  return lanes;
}

/**
 * Redraw the brackets of `groups` (arrays of indices into the requests) into `gutter`, measuring the rows of `list`.
 * `anchorOf(index)` is the element that stands for a request: its row, or the header of a collapsed group around it.
 * Return the number of groups with at least two anchors that found no lane.
 */
export function drawBrackets(gutter, list, groups, anchorOf) {
  const listTop = list.getBoundingClientRect().top;
  const spans = [];
  for (const group of groups) {
    const span = groupSpan(group, anchorOf, listTop);
    if (span !== null) {
      spans.push(span);
    }
  }
  spans.sort((first, second) => first.top - second.top);
  const lanes = assignLanes(spans, MAX_LANES);
  const brackets = [];
  for (let index = 0; index < spans.length; index += 1) {
    if (lanes[index] !== null) {
      brackets.push(bracket(spans[index], lanes[index]));
    }
  }
  gutter.replaceChildren(...brackets);
  return spans.length - brackets.length;
}

/** `{ top, bottom, requests }` from the middle of the group's first anchor to the middle of its last; null for one. */
function groupSpan(group, anchorOf, listTop) {
  const anchors = new Set(group.map(anchorOf));
  if (anchors.size < 2) {
    return null;
  }
  const middles = [];
  for (const anchor of anchors) {
    const box = anchor.getBoundingClientRect();
    middles.push(box.top + box.height / 2 - listTop);
  }
  return { top: Math.min(...middles), bottom: Math.max(...middles), requests: group.length };
}

function bracket(span, lane) {
  const element = document.createElement("div");
  element.className = "bracket";
  element.style.top = `${span.top}px`;
  element.style.height = `${span.bottom - span.top}px`;
  element.style.left = `${lane * LANE_WIDTH_REM}rem`;
  // A lane's colour tells crossing brackets apart; there are fewer lanes than series colours.
  element.style.borderColor = SERIES_SLOTS[lane];
  element.title = `${span.requests} requests ran at overlapping times`;
  return element;
}

// A group of one request overlaps nothing.
function addIfOverlapping(groups, group) {
  if (group.length > 1) {
    groups.push(group);
  }
}
