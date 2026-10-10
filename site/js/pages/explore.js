/** The Explore page: weekly trends, headline numbers, distribution cards and the sessions table of the selected weeks. */

import { showError, showLoading } from "../shared/charts.js";
import { openDatabase } from "../shared/database.js";
import { formatCount } from "../shared/format.js";
import { renderFooter, renderHeader } from "../shared/layout.js";
import { readSelection } from "../shared/selection.js";

const selection = new URLSearchParams(window.location.search);
renderHeader(document.querySelector("#site-header"), "index.html", selection);
renderFooter(document.querySelector("#site-footer"));

const headline = document.querySelector("#headline");
showLoading(headline);
showRequestCount(headline).catch((error) => showError(headline, error));

/** Write the number of top-level requests of the selected weeks and scope into `container`. */
async function showRequestCount(container) {
  const weeks = await fetchWeeks();
  const database = await openDatabase(new URL("data/", window.location.href).href);
  await database.setSelection(readSelection(selection, weeks));
  const rows = await database.runQuery("explore/request_count");
  container.textContent = `${formatCount(rows[0].requests)} requests`;
}

/** The weeks of `data/weeks.json`, oldest first. */
async function fetchWeeks() {
  const response = await fetch("data/weeks.json");
  if (!response.ok) {
    throw new Error(`Could not fetch data/weeks.json: ${response.status} ${response.statusText}`);
  }
  return response.json();
}
