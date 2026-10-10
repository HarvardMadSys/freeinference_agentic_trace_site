/** The Paper figures page: the paper's figures, drawn for the selected weeks and scope. */

import { renderFooter, renderHeader } from "../shared/layout.js";

const selection = new URLSearchParams(window.location.search);
renderHeader(document.querySelector("#site-header"), "figures.html", selection);
renderFooter(document.querySelector("#site-footer"));
