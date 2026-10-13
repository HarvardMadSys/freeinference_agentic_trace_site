# Design: split-pages

## 1. Pages, not in-page tabs
The split is three HTML files, each with its own module, rather than one
file that shows one section at a time.
- The site already works this way: the Session page is its own file, the
  host serves `page.html` at `/page` with the query kept, and every page
  draws from the precomputed answers, so each page fetches only what it
  shows.
- A file per page keeps the browser's own back, forward, bookmark and
  "open in new tab" behaviour, and needs no tab state in the URL.
- In-page tabs would keep every section's loading and error state on one
  page and hide most of it, which is the complexity this change removes.

| Page | File | Module | Sections |
|---|---|---|---|
| Overview (the landing page) | `index.html` | `js/pages/overview.js` | hero and stats strip, mixes, trends, Cite, Team |
| Session Explorer | `explorer.html` | `js/pages/explorer.js` | the sessions table with its filter |
| Insights | `insights.html` | `js/pages/insights.js` | the topic bar, the six topics |
| Session | `session.html` | `js/pages/session.js` | unchanged |

`explorer.html`, not `sessions.html`: one letter from `session.html` is
too close, and "explorer" is the section's name.

## 2. Navigation
`SECTIONS` in `shared/layout.js` becomes the list of pages:
`{ file, anchor, title }` with `index.html` and `""` for Overview,
`explorer.html` for Session Explorer, `insights.html` for Insights, and
`index.html` with `#cite` for Cite. A link's address is its file and
anchor; on its own page a link with an anchor is the anchor alone. The
header marks the link whose file is the current page (Cite is never
marked; the Session page marks Session Explorer, as now). The footer's
"On this site" lists the same four.

The table's keys (`months`, `harnesses`, sort, page, search) belong to
the Session Explorer page: the Session Explorer link carries the
caller's query there, from the Session page and from the Session
Explorer page itself; the brand and the other links carry no query.
`renderHeader(container, activeFile, carried)` keeps its signature;
`carried` now reaches one link.

## 3. The Insights page
All six topics stay on one page, in order, with a topic bar rather than
one topic at a time: a figure's link still lands on the figure, the page
still reads top to bottom, and nothing is hidden. The bar is one row
under the sticky header, itself sticky, of the six numbered titles
linking to `#structure`, `#tokens`, `#latency`, `#tools`, `#caching`
and `#comparison`; the topic whose heading last passed the bar is marked
(an `IntersectionObserver` over the topic sections). On a phone the row
scrolls sideways as the header's does. `FIGURE_SECTIONS` keeps its
selectors with the new ids.

Alternative, not taken: one topic shown at a time, chosen by the hash.
It would make the page shorter but hide 24 of 29 figures behind a
click, break anchor links to figures of other topics unless the page
switched topic first, and add state to keep.

## 4. Old links
`index.html#sessions` and `index.html#insights`, `#insights-tokens`, …,
are in the paper's companion links and in shared URLs. The Overview
module, before it draws, maps them: `#sessions` to `explorer.html` with
the query; `#insights` to `insights.html`; `#insights-<topic>` to
`insights.html#<topic>` (`sessions` to `structure`); then
`location.replace`. Unknown hashes stay.

## 5. One start for three pages
`js/explore/start.js` exports `startPage({ file, sections, figureSections })`
with what `pages/explore.js` does today for every page: fetch
`weeks.json` and `harnesses.json` (header, footer and the error in
every section's place on failure), the selection (the default while
frozen), the answers-only database and the four colour orders, the
`page` object, the run of the sections with the loading state, note
and error of each, and `scrollToAnchor`. Each page module calls it with
its own `SECTIONS` list (the `{ id, layout, run }` entries it has now) and,
for the Insights page, the figure sections. `FIGURES_ARE_FROZEN` moves
to `start.js`; the pickers, `changeSelection`, `selectWeek` and the stream
move with it, so that with the switch off each page mounts the pickers
and recomputes its own sections, and the selection travels between pages
in the URL keys the header links carry.

The repository test that checks the database module is statically
imported by the Explore page's module checks `start.js` instead.

## 6. What the landing page becomes
Hero and stats, the two mixes, the three trends, Cite, Team. The hero's
buttons: "Session Explorer" (primary), "Insights", "Dataset", "Paper",
"Code"; five on one row, wrapping on a phone. No doorway cards: the
buttons and the header are the doors.

## 7. Deploy check
The workflow's served-pages check asks for `/`, `/explorer`, `/insights`,
`/data/weeks.json` and one Parquet file, and fails on any status but 200.

## 8. Tests
- `layout.test.js`: each page's header marks its own link, links lead to
  the files, only the Session Explorer link carries the query.
- `landing_hero.test.js`: five buttons, the two site ones first.
- `figure_sections.test.js`: the six selectors are the new anchors.
- A node test for the old-link map (pure function, `hash → address`).
- `test_repository.py`: three Explore page files each importing their
  own module; `start.js` imports the database module statically.
- A browser pass at 1280 and 360 px, light and dark, over the three
  pages and the Session page's back link.
