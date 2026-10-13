# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px, light and dark. No query
and no data change is expected.

## 1. The shared start
- [ ] 1.1 `js/explore/start.js`: `startPage({ file, sections, figureSections })` with the start, the selection, the database, the orders, the runs, the notes and errors, `scrollToAnchor`, and behind `FIGURES_ARE_FROZEN` (moved here) the pickers, the selection change and the stream; `pages/explore.js` reduced to a call of it; the repository test checks `start.js`.

## 2. Three pages
- [ ] 2.1 `pages/overview.js` and `index.html` trimmed to the hero and stats strip, mixes, trends, Cite and Team; the old-link map (`#sessions`, `#insights`, `#insights-<topic>`) applied before the page draws, with its node test; the hero's buttons "Session Explorer", "Insights", "Dataset", "Paper", "Code".
- [ ] 2.2 `explorer.html` and `pages/explorer.js`: the Session Explorer heading and the table with its filter; the table's URL keys read and written there; the Session page's back link to `explorer.html` with the query.
- [ ] 2.3 `insights.html` and `pages/insights.js`: the Insights heading, the topic bar (sticky, six numbered links, the topic in view marked, sideways scroll on a phone) and the six topics with the anchors `#structure`, `#tokens`, `#latency`, `#tools`, `#caching`, `#comparison`; `FIGURE_SECTIONS` and its test follow.
- [ ] 2.4 `shared/layout.js`: `SECTIONS` as pages, the current page's link marked, the query carried to the Session Explorer link alone; the footer's "On this site" the same four; `pages/explore.js` removed; the layout test.

## 3. Close
- [ ] 3.1 The deploy workflow checks `/`, `/explorer` and `/insights`; README (pages table, layout, hosting), CONTRIBUTING (adding a page and a section), `openspec validate split-pages --strict`, a browser pass over the four pages.
