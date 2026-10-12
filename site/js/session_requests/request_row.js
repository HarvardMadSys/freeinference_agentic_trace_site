/**
 * One row of the Requests view: a request's label, its elapsed time, its token bar and a chip per tool call.
 *
 * The bar's parts are sized in percent of the largest request of the tree (input plus output), so bars compare
 * across every agent. `request` is a row of `session/session_requests`, `calls` its rows of
 * `session/session_tool_calls`.
 */

import { OTHER_SERIES, TOKEN_PART_COLOURS } from "../theme/colours.js";
import { elapsedSeconds, formatCount, formatElapsed } from "../shared/format.js";
import { programsText } from "./request_details.js";

// A request with more tool calls than this shows the first ones as chips and the rest as one "+ N more" chip; its
// details list every call. A few requests call thousands of tools, and their chips would bury the list.
const MAX_CHIPS = 12;

/** "Turn N" for a request a user's message started, "↳ step S" for one a tool result started. */
export function rowLabel(request) {
  return request.step_trigger === "user" ? `Turn ${request.turn}` : `↳ step ${request.step}`;
}

/** The request's start and end as time since `originMs`: "+MM:SS–MM:SS", each with hours from an hour on. */
export function elapsedRange(request, originMs) {
  const start = formatElapsed(elapsedSeconds(request.start_ms, originMs));
  const end = formatElapsed(elapsedSeconds(request.end_ms, originMs));
  return `${start}–${end.replace("+", "")}`;
}

/**
 * The parts of a request's bar in drawing order, `[{ tokens, colour, title }]`, leaving out empty parts: its cached
 * input, uncached input and output; or, when its provider reported no cache reads, its whole input and its output.
 */
export function barParts(request) {
  const parts = [];
  if (request.cache_read_tokens === null) {
    const title = `${formatCount(request.prompt_tokens)} input tokens, no cache report`;
    parts.push({ tokens: request.prompt_tokens, colour: OTHER_SERIES, title });
  } else {
    const cachedTitle = `${formatCount(request.cache_read_tokens)} cached input tokens`;
    const uncachedTitle = `${formatCount(request.uncached_tokens)} uncached input tokens`;
    parts.push({ tokens: request.cache_read_tokens, colour: TOKEN_PART_COLOURS.cached, title: cachedTitle });
    parts.push({ tokens: request.uncached_tokens, colour: TOKEN_PART_COLOURS.uncached, title: uncachedTitle });
  }
  const outputTitle = `${formatCount(request.completion_tokens)} output tokens`;
  parts.push({ tokens: request.completion_tokens, colour: TOKEN_PART_COLOURS.output, title: outputTitle });
  return parts.filter((part) => part.tokens > 0);
}

/** The width of `tokens` in percent of `largestTokens`, the token count a full-width bar stands for. */
export function barWidth(tokens, largestTokens) {
  return `${(100 * tokens) / largestTokens}%`;
}

/** A chip's tooltip: the call's name, category, programs when it has them, and outcome, joined by " · ". */
export function chipTitle(call) {
  const parts = [call.name, call.category];
  const programs = programsText(call.programs);
  if (programs !== "") {
    parts.push(programs);
  }
  parts.push(call.outcome ?? "no outcome");
  return parts.join(" · ");
}

/**
 * A row for `request`: a button holding its label, elapsed time, bar and chips.
 * `layout` is `{ originMs, largestTokens, categoryColours }`: the time 0 of the elapsed times, the tokens of a
 * full-width bar, and a map from each tool category to its colour.
 */
export function requestRow(request, calls, layout) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "request-row";
  row.setAttribute("aria-expanded", "false");
  row.append(
    textSpan("request-label", rowLabel(request)),
    textSpan("request-elapsed mono", elapsedRange(request, layout.originMs)),
    tokenBar(request, layout.largestTokens),
    toolChips(calls, layout.categoryColours),
  );
  return row;
}

function tokenBar(request, largestTokens) {
  const bar = document.createElement("span");
  bar.className = "request-bar";
  for (const part of barParts(request)) {
    const element = document.createElement("span");
    element.className = "bar-part";
    element.style.width = barWidth(part.tokens, largestTokens);
    element.style.background = part.colour;
    element.title = part.title;
    bar.append(element);
  }
  return bar;
}

function toolChips(calls, categoryColours) {
  const chips = document.createElement("span");
  chips.className = "request-chips";
  for (const call of calls.slice(0, MAX_CHIPS)) {
    const chip = textSpan("chip", call.name);
    chip.style.setProperty("--chip-color", categoryColours.get(call.category));
    chip.title = chipTitle(call);
    chips.append(chip);
  }
  if (calls.length > MAX_CHIPS) {
    const more = textSpan("chip", `+ ${formatCount(calls.length - MAX_CHIPS)} more`);
    more.title = "Every call is listed in the request's details";
    chips.append(more);
  }
  return chips;
}

function textSpan(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}
