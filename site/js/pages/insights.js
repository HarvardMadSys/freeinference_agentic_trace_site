/**
 * The Insights page: the topic bar, and the paper's figures in six topics, each drawn from its precomputed answer.
 * `explore/start.js` draws and runs them.
 */

import { FIGURE_SECTIONS } from "../explore/figure_sections.js";
import { startPage } from "../explore/start.js";
import { mountTopicBar } from "../explore/topic_bar.js";

// The page's own file, which the header marks as the current page.
const PAGE_FILE = "insights.html";

// The page has no section but its figure sections.
const SECTIONS = Object.freeze([]);

mountTopicBar(document.querySelector("#topic-bar"), FIGURE_SECTIONS);
startPage({ file: PAGE_FILE, sections: SECTIONS, figureSections: FIGURE_SECTIONS });
