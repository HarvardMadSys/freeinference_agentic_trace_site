/**
 * A session's tree as the Session page reads it: the agents (the top-level session and its subagents at every
 * depth), each agent's requests in start order, and each subagent under the request whose step spawned it.
 *
 * `sessions` are rows of `session/session_tree` and `requests` rows of `session/session_requests`.
 */

// The number of characters of a session id that name it on the page; 8 hex characters tell sessions apart.
const SHORT_ID_LENGTH = 8;

/** The short name of a session: the first eight characters of its id. */
export function shortSessionId(sessionId) {
  return sessionId.slice(0, SHORT_ID_LENGTH);
}

/** The text key of one request of the tree: its session id and step, as "<session_id>/<step>". */
export function requestKey(sessionId, step) {
  return `${sessionId}/${step}`;
}

/**
 * The agent tree rooted at the top-level session: `{ session, rows }`, where each row is `{ request, subagents }`,
 * rows are in start order (the step breaks a tie) and `subagents` are the agents that row's step spawned, as
 * agents of the same shape, in order of their first request. A subagent whose spawning step has no request is
 * placed under its parent's last row.
 */
export function agentTree(sessions, requests) {
  const requestsBySession = groupedBy(requests, "session_id");
  const childrenBySession = groupedBy(sessions, "parent_session_id");
  const topLevel = sessions.find((session) => session.parent_session_id === null);
  return agentNode(topLevel, requestsBySession, childrenBySession);
}

/** A map from each request's key (`requestKey`) to its tool calls, in the order of the rows given. */
export function callsByRequest(toolCalls) {
  const calls = new Map();
  for (const call of toolCalls) {
    const key = requestKey(call.session_id, call.step);
    if (!calls.has(key)) {
      calls.set(key, []);
    }
    calls.get(key).push(call);
  }
  return calls;
}

/** The tool categories of `toolCalls`, most calls first and by name on a tie: the order colours are given in. */
export function categoryOrder(toolCalls) {
  const counts = new Map();
  for (const call of toolCalls) {
    counts.set(call.category, (counts.get(call.category) ?? 0) + 1);
  }
  const categories = [...counts.keys()].sort((first, second) => first.localeCompare(second));
  return categories.sort((first, second) => counts.get(second) - counts.get(first));
}

/** The largest input plus output tokens of one request, at least 1: the token count a full-width bar stands for. */
export function largestRequestTokens(requests) {
  let largest = 1;
  for (const request of requests) {
    largest = Math.max(largest, request.prompt_tokens + request.completion_tokens);
  }
  return largest;
}

function agentNode(session, requestsBySession, childrenBySession) {
  const ownRequests = [...(requestsBySession.get(session.session_id) ?? [])].sort(byStart);
  const rows = ownRequests.map((request) => ({ request, subagents: [] }));
  const children = [...(childrenBySession.get(session.session_id) ?? [])].sort(byFirstStart);
  for (const child of children) {
    const spawningRow = rows.find((row) => row.request.step === child.spawned_by_step) ?? rows.at(-1);
    spawningRow.subagents.push(agentNode(child, requestsBySession, childrenBySession));
  }
  return { session, rows };
}

function groupedBy(rows, column) {
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row[column])) {
      groups.set(row[column], []);
    }
    groups.get(row[column]).push(row);
  }
  return groups;
}

function byStart(first, second) {
  return first.start_ms - second.start_ms || first.step - second.step;
}

function byFirstStart(first, second) {
  return first.first_start_ms - second.first_start_ms;
}
