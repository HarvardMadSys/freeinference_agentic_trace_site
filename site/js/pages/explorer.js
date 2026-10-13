/**
 * The Session Explorer page: the table of every top-level session, with its filter, sort and page in the URL.
 * `explore/start.js` draws and runs it.
 */

import { startPage } from "../explore/start.js";
import { layoutSessionsTable, runSessionsTable } from "../explore/sessions_table.js";

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "explorer.html";

// The one section: the id of its place in explorer.html, the function that draws its loading state, and the one
// that runs it.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "sessions-table", layout: layoutSessionsTable, run: runSessionsTable }),
]);

startPage({ file: PAGE_FILE, sections: SECTIONS });
