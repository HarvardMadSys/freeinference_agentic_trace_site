/**
 * The Requests view: every request of a session's tree as a row of plain HTML, the top-level session's rows first,
 * each subagent's rows in a collapsed group under the row of the step that spawned it, nested to any depth; above
 * them, the legend of a bar's parts and of the chips' tool categories.
 *
 * A click on a row opens its details under it; a click on a group header expands or collapses that group. Brackets in
 * the left gutter join the rows of requests that ran at overlapping times; they are redrawn whenever the list
 * changes size, since expanding a group or opening details moves the rows.
 */

import { drawBrackets, MAX_LANES, overlapGroups } from "./request_brackets.js";
import { requestDetails } from "./request_details.js";
import { requestRow } from "./request_row.js";
import { categoryEntries, legendLine } from "../session/legend.js";
import { tokenPartEntries } from "../session/token_parts.js";
import { agentTree, callsByRequest, largestRequestTokens, requestKey, topLevelSession } from "../session/tree.js";
import { figureDefinition } from "../shared/charts.js";
import { formatCompactCount, formatCount, formatSeconds, shortSessionId } from "../shared/format.js";

// How long a row the URL points at stays highlighted, in milliseconds.
const HIGHLIGHT_MS = 2500;

// The line over the list saying how its times are written, since the list has no column headings.
const TIME_UNIT_NOTE = "Times since the session's first request, in m:ss, or h:mm:ss from an hour on.";

// What the view draws, behind its Definition control above the list.
const DEFINITION =
  "One row per request in start order, each subagent's rows in a group under the step that spawned it. A bar is " +
  "the request's cached input, uncached input and output tokens against the largest request's; output is often a " +
  "sliver. Times run from the session's first request, in m:ss, or h:mm:ss from an hour on. Brackets on the left " +
  `join requests that ran at overlapping times; past ${MAX_LANES} crossing one row, the rest are not drawn.`;

/**
 * Draw the Requests view into `container` and return a function that stops it watching the list's size, to call
 * before the view is replaced. `tree`, `requests` and `toolCalls` are the rows of the session queries. `options` is
 * `{ focusSessionId, focusStep, categoryColours }`: the session the URL names, whose group (when it is a subagent)
 * is expanded and scrolled into view; a step of that session to scroll to and highlight, or null; and the site-wide
 * map from each tool category to its colour.
 */
export function mountRequestsView(container, tree, requests, toolCalls, options) {
  const calls = callsByRequest(toolCalls);
  const categoryColours = options.categoryColours;
  const topLevel = topLevelSession(tree);
  const layout = { originMs: topLevel.first_start_ms, largestTokens: largestRequestTokens(requests), categoryColours };
  const list = document.createElement("div");
  list.className = "request-list";
  const rowsByKey = new Map(); // each request's row element, by `requestKey`
  appendAgent(list, agentTree(tree, requests), { layout, calls, rowsByKey });
  const definition = figureDefinition(DEFINITION);
  const bracketNote = definition.querySelector(".figure-rows");
  bracketNote.hidden = true; // shown when some overlap brackets find no lane
  const legend = requestLegend(toolCalls, categoryColours);
  const timeUnit = document.createElement("p");
  timeUnit.className = "figure-caption";
  timeUnit.textContent = TIME_UNIT_NOTE;
  container.replaceChildren(requestToolbar(list, tree.length > 1), legend, timeUnit, definition, list);
  const stopBrackets = watchBrackets(list, overlapGroups(requests), requests, rowsByKey, bracketNote);
  focusAddress(container, list, rowsByKey, options);
  return stopBrackets;
}

/**
 * Append `agent`'s rows to `parent`, each followed by the groups of the subagents its step spawned. `drawing` is
 * `{ layout, calls, rowsByKey }`: the rows' layout, the tool calls by request key, and the map each row is added to.
 */
function appendAgent(parent, agent, drawing) {
  for (const { request, subagents } of agent.rows) {
    const key = requestKey(request.session_id, request.step);
    const requestCalls = drawing.calls.get(key) ?? [];
    const row = requestRow(request, requestCalls, drawing.layout);
    row.addEventListener("click", () => toggleDetails(row, request, requestCalls));
    drawing.rowsByKey.set(key, row);
    parent.append(row);
    for (const subagent of subagents) {
      parent.append(subagentGroup(subagent, drawing));
    }
  }
}

/** A collapsed group for a subagent: a header that toggles it, and its rows, indented. */
function subagentGroup(agent, drawing) {
  const group = document.createElement("div");
  group.className = "subagent-group";
  group.dataset.sessionId = agent.session.session_id;
  const header = document.createElement("button");
  header.type = "button";
  header.className = "group-header";
  header.textContent = groupTitle(agent.session);
  const groupRows = document.createElement("div");
  groupRows.className = "group-rows";
  appendAgent(groupRows, agent, drawing);
  group.append(header, groupRows);
  setExpanded(group, false);
  header.addEventListener("click", () => setExpanded(group, groupRows.hidden));
  return group;
}

/** "↳ subagent 5478226a · 12 requests · 3m 04s · 120.4k tokens": its own requests, duration and input plus output. */
function groupTitle(session) {
  const requestWord = session.requests === 1 ? "request" : "requests";
  const tokens = formatCompactCount(session.input_tokens + session.output_tokens);
  const requests = `${formatCount(session.requests)} ${requestWord}`;
  const duration = formatSeconds(session.duration_s);
  return `↳ subagent ${shortSessionId(session.session_id)} · ${requests} · ${duration} · ${tokens} tokens`;
}

// A group's header is its first child and its rows its last, as `subagentGroup` builds it.
function setExpanded(group, isExpanded) {
  group.firstElementChild.setAttribute("aria-expanded", String(isExpanded));
  group.lastElementChild.hidden = !isExpanded;
}

/**
 * The legend of the bars and chips: the three parts of a bar, then the categories of `toolCalls` in the site-wide
 * order of `categoryColours`, the ones folded into the Other colour as one entry; no category line without a call.
 */
function requestLegend(toolCalls, categoryColours) {
  const legend = document.createElement("div");
  legend.append(legendLine("Tokens", tokenPartEntries()));
  const categories = categoryEntries(toolCalls, categoryColours);
  if (categories.length > 0) {
    legend.append(legendLine("Tool calls", categories));
  }
  return legend;
}

/** The Expand all and Collapse all buttons, when the tree has subagents; an empty bar otherwise. */
function requestToolbar(list, hasSubagents) {
  const toolbar = document.createElement("div");
  toolbar.className = "request-toolbar";
  if (!hasSubagents) {
    return toolbar;
  }
  for (const [text, isExpanded] of [["Expand all", true], ["Collapse all", false]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.addEventListener("click", () => setEveryGroupExpanded(list, isExpanded));
    toolbar.append(button);
  }
  return toolbar;
}

function setEveryGroupExpanded(list, isExpanded) {
  for (const group of list.querySelectorAll(".subagent-group")) {
    setExpanded(group, isExpanded);
  }
}

/** Open `row`'s details under it, closing any other row's; a second click closes them. */
function toggleDetails(row, request, calls) {
  const wasOpen = row.getAttribute("aria-expanded") === "true";
  const list = row.closest(".request-list");
  for (const openRow of list.querySelectorAll('.request-row[aria-expanded="true"]')) {
    openRow.setAttribute("aria-expanded", "false");
    openRow.nextElementSibling.remove();
  }
  if (!wasOpen) {
    row.after(requestDetails(request, calls));
    row.setAttribute("aria-expanded", "true");
  }
}

/**
 * Draw the overlap brackets now and whenever the list's size changes, and say how many found no lane.
 * Return a function that stops the redrawing.
 */
function watchBrackets(list, groups, requests, rowsByKey, note) {
  if (groups.length === 0) {
    return () => undefined;
  }
  list.classList.add("has-brackets");
  const gutter = document.createElement("div");
  gutter.className = "bracket-gutter";
  list.prepend(gutter);
  const keys = requests.map((request) => requestKey(request.session_id, request.step));
  const anchorOf = (index) => visibleAnchor(rowsByKey.get(keys[index]));
  const redraw = () => showUndrawn(note, drawBrackets(gutter, list, groups, anchorOf));
  // The observer also calls `redraw` once when it starts, after the list's first layout.
  const observer = new ResizeObserver(redraw);
  observer.observe(list);
  return () => observer.disconnect();
}

function showUndrawn(note, undrawn) {
  note.hidden = undrawn === 0;
  note.textContent = `${formatCount(undrawn)} overlap brackets are not drawn here.`;
}

/** The element that stands for `row` on screen: the row, or the header of the outermost collapsed group around it. */
function visibleAnchor(row) {
  let anchor = row;
  let group = row.parentElement.closest(".subagent-group");
  while (group !== null) {
    if (group.lastElementChild.hidden) {
      anchor = group.firstElementChild;
    }
    group = group.parentElement.closest(".subagent-group");
  }
  return anchor;
}

/** Expand the group of the session the URL names, then scroll to its step's row, or else to its group. */
function focusAddress(container, list, rowsByKey, { focusSessionId, focusStep }) {
  const group = list.querySelector(`.subagent-group[data-session-id="${CSS.escape(focusSessionId)}"]`);
  for (let around = group; around !== null; around = around.parentElement.closest(".subagent-group")) {
    setExpanded(around, true);
  }
  if (focusStep === null) {
    group?.scrollIntoView({ block: "start" });
    return;
  }
  const row = rowsByKey.get(requestKey(focusSessionId, focusStep));
  if (row === undefined) {
    const note = document.createElement("p");
    note.className = "note";
    note.textContent = `Step ${focusStep} is not a request of session ${shortSessionId(focusSessionId)}.`;
    container.prepend(note);
    return;
  }
  row.scrollIntoView({ block: "center" });
  row.classList.add("is-highlighted");
  setTimeout(() => row.classList.remove("is-highlighted"), HIGHLIGHT_MS);
}
