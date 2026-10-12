/**
 * A request's details, opened under its row in the Requests view: its tokens by role, its timing, how it ended, how
 * its context changed and what it waited for, then each tool call it emitted.
 *
 * `request` is a row of `session/session_requests`, `calls` its rows of `session/session_tool_calls`. A call's
 * `programs` is a list of strings (an array, or an Arrow vector from DuckDB), null for a call that is not a shell call;
 * its `arguments_skeleton` is a JSON string of its arguments with every value replaced by its type.
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
  ["Programs", false],
  ["Outcome", false],
  ["Latency", true],
  ["Result tokens", true],
]);

// The keys of a shell call's arguments that hold its command line: a shell's command, an interpreter's code.
const COMMAND_KEYS = Object.freeze(["command", "code"]);

/** A call's programs in the command's order joined by commas, "nc, echo, echo"; blank for a call with none. */
export function programsText(programs) {
  return programs === null ? "" : Array.from(programs).join(", ");
}

/**
 * The line under a call in the details: a shell call's command with every value replaced by its type, or any other
 * call's argument names and value types, "path: <path>, diff: <path>". A skeleton that is not a JSON object is shown
 * as it is, and a missing one as a dash.
 */
export function skeletonText(call) {
  if (call.arguments_skeleton === null) {
    return MISSING_TEXT;
  }
  const skeleton = skeletonObject(call.arguments_skeleton);
  if (skeleton === null) {
    return call.arguments_skeleton;
  }
  if (call.programs !== null) {
    const commandKey = COMMAND_KEYS.find((key) => typeof skeleton[key] === "string");
    if (commandKey !== undefined) {
      return skeleton[commandKey];
    }
  }
  const pairs = [];
  for (const [name, type] of Object.entries(skeleton)) {
    pairs.push(`${name}: ${typeof type === "string" ? type : JSON.stringify(type)}`);
  }
  return pairs.join(", ");
}

/** The skeleton `text` parsed, when it is a JSON object; null otherwise. */
function skeletonObject(text) {
  let skeleton;
  try {
    skeleton = JSON.parse(text);
  } catch {
    return null;
  }
  const isObject = skeleton !== null && typeof skeleton === "object" && !Array.isArray(skeleton);
  return isObject ? skeleton : null;
}

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
    appendCallRows(body, call);
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  return wrap;
}

/** A call's row of cells, then a row spanning every column with its skeleton in monospace. */
function appendCallRows(body, call) {
  const cells = [call.name, call.category, programsText(call.programs), call.outcome ?? MISSING_TEXT,
    secondsOrMissing(call.latency_ms), countOrMissing(call.result_tokens)];
  const row = body.insertRow();
  row.className = "call-row";
  for (let index = 0; index < cells.length; index += 1) {
    const cell = row.insertCell();
    cell.textContent = cells[index];
    cell.classList.toggle("is-number", CALL_HEADINGS[index][1]);
  }
  const skeletonCell = body.insertRow().insertCell();
  skeletonCell.className = "call-skeleton mono";
  skeletonCell.colSpan = CALL_HEADINGS.length;
  skeletonCell.textContent = skeletonText(call);
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
