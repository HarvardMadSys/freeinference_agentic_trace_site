/** The About page: definitions, how the data were built, and links. */

import { renderFooter, renderHeader } from "../shared/layout.js";

const selection = new URLSearchParams(window.location.search);
renderHeader(document.querySelector("#site-header"), "about.html", selection);
renderFooter(document.querySelector("#site-footer"));
