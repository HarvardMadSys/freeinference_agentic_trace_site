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
