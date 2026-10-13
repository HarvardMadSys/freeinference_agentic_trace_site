# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px, light and dark. No query
and no data change is expected.

## 1. One page
- [x] 1.1 `index.html` holds every section in order (hero and stats, Overview, Session Explorer with its new line and without the "A month holds…" line, Insights with the six topics under the anchors `#insights-sessions` … `#insights-comparison`, Cite, Team); one `pages/explore.js` over `start.js`; `explorer.html`, `insights.html`, `pages/overview.js`, `pages/explorer.js`, `pages/insights.js` and `landing/old_links.js` removed; `layout.js` back to anchors with the Session page carrying the keys; the Session page's back link; the tests that follow.

## 2. The tabs
- [ ] 2.1 `explore/topic_tabs.js` from `topic_bar.js`: the tab row, one topic shown at a time, the hash as the shown topic (`pushState` on click, `popstate`, the hash on load), the row scrolling sideways on a phone; `figure_sections.js` draws a topic's figures when it is shown; CSS; the tests.

## 3. Close
- [ ] 3.1 The deploy workflow checks `/` and the data files; README, CONTRIBUTING, `CLAUDE.md`; `openspec validate insights-tabs --strict`; the browser pass.
