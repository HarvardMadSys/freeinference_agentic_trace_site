/**
 * The Overview page, the landing page: the hero with its stats strip, the model and harness mixes and weekly trends,
 * and the citation and the team. `explore/start.js` draws and runs them. A link to one of the page's old anchors,
 * `#sessions` or `#insights…`, is sent on to the page that holds that section now, before anything is drawn.
 */

import { startPage } from "../explore/start.js";
import { layoutTrends, runTrends } from "../explore/trends.js";
import { layoutMixes, runMixes } from "../landing/donuts.js";
import { mountCopyButtons, renderCiteLine } from "../landing/cite.js";
import { renderHero } from "../landing/hero.js";
import { oldLinkAddress } from "../landing/old_links.js";
import { layoutStats, runStats } from "../landing/stats.js";
import { renderTeam } from "../landing/team.js";

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "index.html";

// Each section: the id of its place in index.html, the function that draws its loading state, the one that runs it,
// and whether it reads the answer of sessions per week by harness.
const SECTIONS = Object.freeze([
  Object.freeze({ id: "stats", layout: layoutStats, run: runStats }),
  Object.freeze({ id: "mixes", layout: layoutMixes, run: runMixes, readsSessionsPerWeek: true }),
  Object.freeze({ id: "trends", layout: layoutTrends, run: runTrends, readsSessionsPerWeek: true }),
]);

const oldLink = oldLinkAddress(window.location.hash, window.location.search);
if (oldLink === null) {
  renderTeam(document.querySelector("#team"));
  renderCiteLine(document.querySelector("#cite-line"));
  mountCopyButtons(document, navigator.clipboard);
  startPage({
    file: PAGE_FILE,
    sections: SECTIONS,
    showWeekCount: (weekCount) => renderHero(document.querySelector("#hero"), weekCount),
  });
} else {
  // Replaced, not pushed, so the browser's Back skips the old address rather than sending the visitor on again.
  window.location.replace(oldLink);
}
