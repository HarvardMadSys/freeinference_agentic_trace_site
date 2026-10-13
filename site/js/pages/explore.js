/**
 * The Explore page, the landing page: the hero with its stats strip, the model and harness mixes and weekly trends, the
 * Session Explorer's table, the paper's figures in six topics, and the citation and the team. `explore/start.js`
 * draws and runs them.
 */

import { FIGURE_SECTIONS } from "../explore/figure_sections.js";
import { startPage } from "../explore/start.js";
import { layoutSessionsTable, runSessionsTable } from "../explore/sessions_table.js";
import { layoutTrends, runTrends } from "../explore/trends.js";
import { layoutMixes, runMixes } from "../landing/donuts.js";
import { mountCopyButtons, renderCiteLine } from "../landing/cite.js";
import { renderHero } from "../landing/hero.js";
import { layoutStats, runStats } from "../landing/stats.js";
import { renderTeam } from "../landing/team.js";

// The page's own file, which the header's links are written against.
const PAGE_FILE = "index.html";

// Each section: the id of its place in index.html, the function that draws its loading state, the one that runs it,
// and whether it reads the answer of sessions per week by harness.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "stats", layout: layoutStats, run: runStats }),
  Object.freeze({ id: "mixes", layout: layoutMixes, run: runMixes, readsSessionsPerWeek: true }),
  Object.freeze({ id: "trends", layout: layoutTrends, run: runTrends, readsSessionsPerWeek: true }),
  Object.freeze({ id: "sessions-table", layout: layoutSessionsTable, run: runSessionsTable }),
]);

renderTeam(document.querySelector("#team"));
renderCiteLine(document.querySelector("#cite-line"));
mountCopyButtons(document, navigator.clipboard);
startPage({
  file: PAGE_FILE,
  sections: SECTIONS,
  figureSections: FIGURE_SECTIONS,
  showWeekCount: (weekCount) => renderHero(document.querySelector("#hero"), weekCount),
});
