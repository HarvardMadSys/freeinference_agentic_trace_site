/**
 * The Session page's URL: `week` and `id` name the session, `view` the view shown, `step` a request to point at.
 * Every other key is the selection the visitor came from, carried by the header and the link back to Explore.
 */

/** The views of the Session page, in the order of their tabs. */
export const VIEW_NAMES = Object.freeze(["requests", "context", "timeline"]);

// The URL keys the Session page reads for itself; they are dropped from the links to other pages.
const SESSION_KEYS = Object.freeze(["week", "id", "view", "step"]);

// The view a URL with no `view`, or an unknown one, opens.
const DEFAULT_VIEW = "requests";

// A step as a URL writes it: a whole number, no sign.
const STEP_PATTERN = /^\d+$/;

/**
 * `{ week, id, view, step }` from the URL: the week's Sunday and the session id as given (null when absent), a
 * known view, and the step as a number (null when absent or not a whole number). The step is one of the
 * session `id`'s own requests, so a subagent's id with a step points at that subagent's request.
 */
export function readAddress(params) {
  const view = params.get("view");
  const step = params.get("step");
  return {
    week: params.get("week"),
    id: params.get("id"),
    view: VIEW_NAMES.includes(view) ? view : DEFAULT_VIEW,
    step: step !== null && STEP_PATTERN.test(step) ? Number(step) : null,
  };
}

/** A copy of `params` without the Session page's own keys: the selection a link to another page carries. */
export function selectionParameters(params) {
  const selection = new URLSearchParams(params);
  for (const key of SESSION_KEYS) {
    selection.delete(key);
  }
  return selection;
}

/** A copy of `params` that opens `view`, without a step to point at. */
export function viewParameters(params, view) {
  const viewParams = new URLSearchParams(params);
  viewParams.set("view", view);
  viewParams.delete("step");
  return viewParams;
}

/** A copy of `params` that opens the Requests view at the request `step` of the session `sessionId`. */
export function requestParameters(params, sessionId, step) {
  const requestParams = new URLSearchParams(params);
  requestParams.set("id", sessionId);
  requestParams.set("view", "requests");
  requestParams.set("step", String(step));
  return requestParams;
}
