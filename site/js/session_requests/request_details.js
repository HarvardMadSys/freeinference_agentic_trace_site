/**
 * A request's details, opened under its row in the Requests view: its tokens by role, its timing, how it ended, how
 * its context changed and what it waited for, then each tool call it emitted.
 *
 * `request` is a row of `session/session_requests`, `calls` its rows of `session/session_tool_calls`.
 */

import { formatCount, formatSeconds, MILLISECONDS_PER_SECOND, MISSING_TEXT } from "../shared/format.js";

// The input token roles, in the order the details list them, with their column in the requests.
const ROLE_COLUMNS = Object.freeze([
  ["System", "system_tokens"],
  ["User", "user_tokens"],
  ["Assistant", "assistant_tokens"],
  ["Tool results", "tool_tokens"],
  ["Tool definitions", "tool_definition_tokens"],
]);

// The columns of the tool-call table: heading, and whether its cells are numbers.
const CALL_HEADINGS = Object.freeze([
  ["Name", false],
  ["Category", false],
  ["Outcome", false],
  ["Latency", true],
  ["Result tokens", true],
]);

/** The request's facts in the order the details show them: `[{ label, value }]`, every value a string. */
export function detailFacts(request) {
  const facts = [
    { label: "Model", value: `${request.model} at provider ${request.provider}` },
    { label: "Input tokens", value: inputText(request) },
  ];
  for (const [label, column] of ROLE_COLUMNS) {
    facts.push({ label, value: countOrMissing(request[column]) });
  }
  facts.push(
    { label: "Output tokens", value: formatCount(request.completion_tokens) },
    { label: "Messages", value: formatCount(request.n_messages) },
    { label: "Time to first token", value: secondsOrMissing(request.ttft_ms) },
    { label: "Duration", value: secondsOrMissing(request.end_ms - request.start_ms) },
    { label: "Finish reason", value: request.finish_reason ?? MISSING_TEXT },
    { label: "Transition", value: transitionText(request) },
    { label: "Waited for", value: waitText(request) },
  );
  return facts;
}

/** A details panel for `request` and its tool calls. */
export function requestDetails(request, calls) {
  const panel = document.createElement("div");
  panel.className = "details";
  const list = document.createElement("dl");
  for (const fact of detailFacts(request)) {
    const term = document.createElement("dt");
    term.textContent = fact.label;
    const definition = document.createElement("dd");
    definition.textContent = fact.value;
    // Each pair in its own element, so the stylesheet can lay the pairs out in a grid.
    const pair = document.createElement("div");
    pair.append(term, definition);
    list.append(pair);
  }
  panel.append(list);
  if (calls.length > 0) {
    panel.append(callTable(calls));
  }
  return panel;
}

function callTable(calls) {
  const table = document.createElement("table");
  table.className = "data-table";
  const headingRow = table.createTHead().insertRow();
  for (const [heading, isNumber] of CALL_HEADINGS) {
    const cell = document.createElement("th");
    cell.textContent = heading;
    cell.classList.toggle("is-number", isNumber);
    headingRow.append(cell);
  }
  const body = table.createTBody();
  for (const call of calls) {
    const cells = [call.name, call.category, call.outcome ?? MISSING_TEXT, secondsOrMissing(call.latency_ms),
      countOrMissing(call.result_tokens)];
    const row = body.insertRow();
    for (let index = 0; index < cells.length; index += 1) {
      const cell = row.insertCell();
      cell.textContent = cells[index];
      cell.classList.toggle("is-number", CALL_HEADINGS[index][1]);
    }
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  return wrap;
}

function inputText(request) {
  const input = formatCount(request.prompt_tokens);
  if (request.cache_read_tokens === null) {
    return `${input}, no cache report`;
  }
  const cached = formatCount(request.cache_read_tokens);
  const uncached = formatCount(request.uncached_tokens);
  return `${input}: ${cached} cached, ${uncached} uncached`;
}

/** "mutation (compaction)", "append", or a dash at a session's first request, which has no transition. */
function transitionText(request) {
  if (request.transition === null) {
    return MISSING_TEXT;
  }
  return request.cause === null ? request.transition : `${request.transition} (${request.cause})`;
}

/** "tool, 4.2s", or a dash at a session's first request, which waited for nothing. */
function waitText(request) {
  if (request.waited_for === null) {
    return MISSING_TEXT;
  }
  const wait = request.wait_s === null ? MISSING_TEXT : formatSeconds(request.wait_s);
  return `${request.waited_for}, ${wait}`;
}

function countOrMissing(count) {
  return count === null ? MISSING_TEXT : formatCount(count);
}

function secondsOrMissing(milliseconds) {
  return milliseconds === null ? MISSING_TEXT : formatSeconds(milliseconds / MILLISECONDS_PER_SECOND);
}
