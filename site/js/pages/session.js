/** The Session page: one session and its subagents, in the Requests, Context and Timeline views. */

import { renderFooter, renderHeader } from "../shared/layout.js";

const selection = new URLSearchParams(window.location.search);
renderHeader(document.querySelector("#site-header"), "session.html", selection);
renderFooter(document.querySelector("#site-footer"));
