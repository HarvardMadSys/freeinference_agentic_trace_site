# Change: split-pages

## Why
The landing page carries everything: the hero and stats, five Overview
cards, the table of 12,002 sessions, 29 figures in six topics, the
citation and the team. It is long to scroll, slow to take in, and the
header's four links only jump within it. A visitor who wants one thing,
the sessions or the figures, gets the whole page.

## What changes
- **Three Explore pages instead of one.** The landing page keeps the
  hero and stats strip, the Overview (mixes and trends), Cite and Team.
  The Session Explorer moves to its own page, `explorer.html`; the
  Insights move to theirs, `insights.html`. The Session page stays.
- **The header links pages.** The four links keep their names, Overview,
  Session Explorer, Insights, Cite, but lead to `index.html`,
  `explorer.html`, `insights.html` and `index.html#cite`; the current
  page's link is marked. The hero gets two site buttons, "Session
  Explorer" and "Insights", before Dataset, Paper and Code.
- **A topic bar on the Insights page.** Under the header, one row of the
  six numbered topics, sticky, the topic in view marked; the topics keep
  their order and figures, with short anchors (`#structure`, `#tokens`,
  `#latency`, `#tools`, `#caching`, `#comparison`).
- **Old links keep working.** The landing page sends `#sessions` to the
  Session Explorer page and `#insights…` to the Insights page's topic,
  with the query kept.
- **The table's URL keys live on the Session Explorer page.** The Session
  page's back link and the header's Session Explorer link carry them
  there; the other links carry none.
- **One start for three pages.** The fetch of `weeks.json` and
  `harnesses.json`, the header and footer, the answers-only database, the
  colour orders and the error state move into one shared module; each
  page module lists only its own sections. The frozen switch lives there.

## Impact
- Specs: `explore-page` (the pages, the table's and the Insights' place,
  the hero's buttons, the start of each page), `site-repository`
  (navigation, layout, the switch's home, the deploy check),
  `session-page` (the back link), `week-selection` (which page the keys
  reach).
- Code: `site/index.html` trimmed, new `site/explorer.html` and
  `site/insights.html`; `js/pages/explore.js` becomes `overview.js`,
  `explorer.js` and `insights.js` over a shared `js/explore/start.js`;
  `js/shared/layout.js` (links to pages), `js/landing/hero.js` (buttons),
  `js/explore/figure_sections.js` (anchors), `js/pages/session.js` (back
  link), `style.css` (topic bar); the deploy workflow checks the three
  pages; README, CONTRIBUTING; the layout, hero, figure-section and
  repository tests.
- Data: no query changes; no `make data`.
