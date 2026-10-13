# Design: insights-tabs

## 1. One page, the shared start kept
`js/explore/start.js` stays as the page's start; the one page module,
`js/pages/explore.js`, lists every section (stats, mixes, trends, the
sessions table) and the figure sections, and calls `startPage` once.
`overview.js`, `explorer.js`, `insights.js` and `landing/old_links.js` go.
The `#selection` card is one, hidden while frozen, as before the split.

## 2. The tabs
`js/explore/topic_tabs.js` replaces `topic_bar.js`. It mounts one row of
six buttons (`role="tablist"`, each `role="tab"`, `aria-selected` on the
shown one; the styling of the former topic bar's links) under the
Insights heading, and shows one topic section at a time: the others get
`hidden`. The topic anchors are the ones before the split,
`#insights-sessions`, `#insights-tokens`, `#insights-latency`,
`#insights-tools`, `#insights-caching`, `#insights-comparison`, so links
from before the split work unchanged.

The shown topic is the URL's hash: a click calls `history.pushState`
with `#insights-<topic>` and shows it; `popstate` shows the hash's topic;
on load, a hash naming a topic shows it and scrolls to the Insights
heading, `#insights` or no hash shows the first. A hash naming anything
else (`#sessions`, `#cite`) leaves the first topic shown and scrolls as
the browser does. The row scrolls sideways on a phone and keeps the shown
tab in it (`bringIntoRow`).

## 3. Drawing on show
A chart reads its width from its container; a hidden container reads 0
and the chart falls back to a fixed width. So a hidden topic's figures
are not drawn until its tab is shown. `figure_sections.js` already keeps
`visibleNames`, the figures whose cards are in view, and starts a run's
figures from it when the run does not draw at once; the tabs use the same
gate: a run draws at once only the shown topic's figures, and showing a
topic starts its figures for the current run if they are not drawn yet.
The simplest implementation: `showTopic` adds the topic's figure names
to `visibleNames` and calls the same "start what is wanted" step a scroll
does. A topic shown twice in one run is not drawn twice.

## 4. The Session Explorer's lines
The sessions table's "A month holds…" line goes from the markup and from
the spec. A line under the Session Explorer heading, in the muted text
style of the figure captions, reads "Click a session to open its
requests, context and timeline." (the Session page's three views).

## 5. Navigation
`SECTIONS` in `shared/layout.js` returns to anchors on `index.html`:
Overview `#overview`, Session Explorer `#sessions`, Insights `#insights`,
Cite `#cite`; on the Explore page a link is its anchor alone; the Session
page marks Session Explorer and its links carry the table's keys, as
before the split. The hero keeps five buttons; "Session Explorer" and
"Insights" scroll to their sections.

## 6. Deploy check and docs
The workflow asks for `/`, `/data/weeks.json` and one Parquet file.
README's page table and layout, CONTRIBUTING's page pattern and
`CLAUDE.md`'s pointer follow.

## 7. Tests
- `explore_topic_tabs.test.js` (from `explore_topic_bar.test.js`): the
  markup, which topic a hash names, that showing hides the others.
- `figure_sections.test.js`: the selectors are the old anchors; a run
  that draws at once draws the shown topic's figures and the rest on show.
- `layout.test.js`: anchors again, the Session page carries the keys.
- `landing_old_links.test.js` goes; `test_repository.py`: one Explore
  page file.
- Browser pass at 1280 and 360 px, light and dark: tabs switch, Back
  returns to the previous tab, a link to `#insights-caching` opens that
  tab, charts in a tab shown later are full width, the back link from a
  session lands on the table with its state.
