/** The Explore page: weekly trends, headline numbers, distribution cards and the sessions table of the selected weeks. */

import { renderFooter, renderHeader } from "../shared/layout.js";

const selection = new URLSearchParams(window.location.search);
renderHeader(document.querySelector("#site-header"), "index.html", selection);
renderFooter(document.querySelector("#site-footer"));
