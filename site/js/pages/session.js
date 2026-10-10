/** The Session page: one session and its subagents, in the Requests, Context and Timeline views. */

import { readAddress, selectionParameters, viewParameters, VIEW_NAMES } from "../session/address.js";
import { mountFacts, sessionFacts } from "../session/facts.js";
import { mountRequestsView } from "../session/requests.js";
import { shortSessionId } from "../session/tree.js";
import { showError, showLoading, showNote } from "../shared/charts.js";
import { openDatabase } from "../shared/database.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { selectionQuery } from "../shared/selection.js";

// The title of each view's tab.
const VIEW_TITLES = Object.freeze({ requests: "Requests", context: "Context", timeline: "Timeline" });

const parameters = new URLSearchParams(window.location.search);
const selection = selectionParameters(parameters);
renderHeader(document.querySelector("#site-header"), "session.html", selection);
renderFooter(document.querySelector("#site-footer"));
document.querySelector("#back-link").href = `index.html${selectionQuery(selection)}`;

const page = {
  title: document.querySelector("#session-title"),
  sessionId: document.querySelector("#session-id"),
  facts: document.querySelector("#facts"),
  tabs: document.querySelector("#views"),
  view: document.querySelector("#view"),
};
showLoading(page.facts);
showLoading(page.view);
openSession(readAddress(parameters)).catch((error) => {
  showError(page.facts, error);
  page.view.hidden = true;
});

/** Load the session the address names and fill the page; a note when it names no session of its week. */
async function openSession(address) {
  if (address.week === null || address.id === null) {
    showNotFound("This link names no session. Open one from the sessions table of the Explore page.");
    return;
  }
  const database = await openDatabase(new URL("data/", window.location.href).href);
  const session = await loadSession(database, address);
  if (session === null) {
    showNotFound(`Session not found in this week: no session ${address.id} in the week of ${address.week}.`);
    return;
  }
  const topLevel = session.tree.find((agent) => agent.depth === 0);
  page.title.textContent = `Session ${shortSessionId(topLevel.session_id)}`;
  page.sessionId.textContent = topLevel.session_id;
  mountFacts(page.facts, sessionFacts(session.tree, session.requests));
  // A tab's link names no step, so a view chosen by its tab points at no request.
  mountViewTabs(page.tabs, address.view, (view) => showView(view, session, { ...address, step: null }));
  showView(address.view, session, address);
}

/**
 * `{ tree, requests, toolCalls }`: the rows of the tree holding the session `address.id`, whether that is the
 * top-level session or one of its subagents; null when the id is unknown or belongs to another week.
 */
async function loadSession(database, address) {
  const roots = await database.runQueryWith("session/session_root", [address.id]);
  if (roots.length === 0 || roots[0].week !== address.week) {
    return null;
  }
  await database.setSession({ week: address.week, rootSessionId: roots[0].root_session_id });
  const [tree, requests, toolCalls] = await Promise.all([
    database.runQuery("session/session_tree"),
    database.runQuery("session/session_requests"),
    database.runQuery("session/session_tool_calls"),
  ]);
  return { tree, requests, toolCalls };
}

/** Draw the view `view` of the loaded session into the view section, pointing at the address's session and step. */
function showView(view, session, address) {
  if (view === "requests") {
    const options = { focusSessionId: address.id, focusStep: address.step };
    mountRequestsView(page.view, session.tree, session.requests, session.toolCalls, options);
    return;
  }
  showNote(page.view, `The ${VIEW_TITLES[view]} view is not drawn yet.`);
}

/** Fill `container` with one tab per view; a click shows that view in place and writes it into the URL. */
function mountViewTabs(container, activeView, onChoose) {
  const tabs = VIEW_NAMES.map((view) => viewTab(view, activeView));
  for (const tab of tabs) {
    tab.addEventListener("click", (event) => {
      if (opensElsewhere(event)) {
        return;
      }
      event.preventDefault();
      history.replaceState(null, "", tab.href);
      for (const other of tabs) {
        markActive(other, other === tab);
      }
      onChoose(tab.dataset.view);
    });
  }
  container.replaceChildren(...tabs);
}

function viewTab(view, activeView) {
  const tab = document.createElement("a");
  tab.className = "view-tab";
  tab.dataset.view = view;
  tab.textContent = VIEW_TITLES[view];
  tab.href = selectionQuery(viewParameters(parameters, view));
  markActive(tab, view === activeView);
  return tab;
}

function markActive(tab, isActive) {
  tab.classList.toggle("is-active", isActive);
  if (isActive) {
    tab.setAttribute("aria-current", "page");
  } else {
    tab.removeAttribute("aria-current");
  }
}

/** A click with a modifier key or another button opens the link in a new tab or window, as the browser does. */
function opensElsewhere(event) {
  return event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey;
}

function showNotFound(text) {
  showNote(page.facts, text);
  page.tabs.hidden = true;
  page.view.hidden = true;
}
