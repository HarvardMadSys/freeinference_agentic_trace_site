/** The Session page: one session and its subagents, in the Requests, Context and Timeline views. */

import {
  readAddress, requestParameters, selectionParameters, viewParameters, VIEW_NAMES,
} from "../session/address.js";
import { mountContextView } from "../session_charts/context.js";
import { sessionFacts } from "../session/facts.js";
import { mountRequestsView } from "../session_requests/requests.js";
import { mountTimelineView } from "../session_charts/timeline.js";
import { OPEN_REQUEST_EVENT } from "../session/view_chart.js";
import { assignColours, showError, showLoading, showNote } from "../shared/charts.js";
import { fetchHarnesses, fetchWeeks, openDatabase } from "../shared/database.js";
import { shortSessionId } from "../shared/format.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { selectionQuery } from "../shared/selection.js";
import { statStrip } from "../shared/tiles.js";

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
openSession(readAddress(parameters)).catch(showFailure);

/** Load the session the address names and fill the page; a note when it names no session of its week. */
async function openSession(address) {
  if (address.week === null || address.id === null) {
    showNotFound("This link names no session. Open one from the sessions table of the Explore page.");
    return;
  }
  const [weeks, harnesses] = await Promise.all([fetchWeeks(), fetchHarnesses()]);
  const database = await openDatabase(new URL("data/", window.location.href).href, weeks, harnesses);
  const session = await loadSession(database, address);
  if (session === null) {
    showNotFound(`Session not found in this week: no session ${address.id} in the week of ${address.week}.`);
    return;
  }
  const topLevel = session.tree.find((agent) => agent.depth === 0);
  page.title.textContent = `Session ${shortSessionId(topLevel.session_id)}`;
  page.sessionId.textContent = topLevel.session_id;
  page.facts.replaceChildren(statStrip(sessionFacts(session.tree, session.requests)));
  const shownView = { stop: showView(address.view, session, address) };
  mountViewTabs(page.tabs, address.view, (view) => switchView(shownView, view, session, address));
  page.view.addEventListener(OPEN_REQUEST_EVENT, (event) => openRequest(shownView, session, address, event.detail));
}

/** Stop the view shown and show `view` instead; `shownView.stop` stops whichever view is shown. */
function switchView(shownView, view, session, address) {
  shownView.stop();
  // A tab's link names no step, so a view chosen by its tab points at no request.
  shownView.stop = showView(view, session, { ...address, step: null });
}

/**
 * Show the Requests view at the request `{ sessionId, step }` a chart's click names, and write it into the URL; the
 * session id may be a subagent's, whose group the Requests view then expands.
 */
function openRequest(shownView, session, address, { sessionId, step }) {
  history.replaceState(null, "", selectionQuery(requestParameters(parameters, sessionId, step)));
  for (const tab of page.tabs.querySelectorAll(".view-tab")) {
    markActive(tab, tab.dataset.view === "requests");
  }
  shownView.stop();
  shownView.stop = showView("requests", session, { ...address, id: sessionId, step });
}

/**
 * `{ tree, requests, toolCalls, categoryColours }`: the rows of the tree holding the session `address.id`, whether
 * that is the top-level session or one of its subagents, and the site-wide colour of each tool category; null when
 * the id is unknown or belongs to another week.
 */
async function loadSession(database, address) {
  const roots = await database.runQueryWith("session/session_root", [address.id]);
  if (roots.length === 0 || roots[0].week !== address.week) {
    return null;
  }
  await database.setSession({ week: address.week, rootSessionId: roots[0].root_session_id });
  const [tree, requests, toolCalls, categoryRows] = await Promise.all([
    database.runQuery("session/session_tree"),
    database.runQuery("session/session_requests"),
    database.runQuery("session/session_tool_calls"),
    database.runQuery("setup/category_order"),
  ]);
  const categoryColours = assignColours(categoryRows.map((row) => row.category));
  return { tree, requests, toolCalls, categoryColours };
}

/**
 * Draw the view `view` of the loaded session into the view section, pointing at the address's session and step.
 * Return a function that stops the view, to call before another replaces it.
 */
function showView(view, session, address) {
  if (view === "context") {
    return mountContextView(page.view, session.tree, session.requests);
  }
  if (view === "timeline") {
    const options = { categoryColours: session.categoryColours };
    return mountTimelineView(page.view, session.tree, session.requests, session.toolCalls, options);
  }
  const options = { focusSessionId: address.id, focusStep: address.step, categoryColours: session.categoryColours };
  return mountRequestsView(page.view, session.tree, session.requests, session.toolCalls, options);
}

/** Fill `container` with one tab per view; a click shows that view in place and writes it into the URL. */
function mountViewTabs(container, activeView, onChoose) {
  const tabs = VIEW_NAMES.map((view) => viewTab(view, activeView));
  for (const tab of tabs) {
    tab.addEventListener("click", (event) => chooseTab(event, tab, tabs, onChoose));
  }
  container.replaceChildren(...tabs);
}

/** Show `tab`'s view in place and write it into the URL; a click that opens the link elsewhere is left alone. */
function chooseTab(event, tab, tabs, onChoose) {
  if (opensElsewhere(event)) {
    return;
  }
  event.preventDefault();
  history.replaceState(null, "", tab.href);
  for (const other of tabs) {
    markActive(other, other === tab);
  }
  onChoose(tab.dataset.view);
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

/** Show the error that stopped the session from loading in place of the facts, and hide the view. */
function showFailure(error) {
  showError(page.facts, error);
  page.view.hidden = true;
}

function showNotFound(text) {
  showNote(page.facts, text);
  page.tabs.hidden = true;
  page.view.hidden = true;
}
