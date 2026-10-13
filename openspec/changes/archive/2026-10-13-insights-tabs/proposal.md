# Change: insights-tabs

## Why
Three pages made the site feel like three sites: a visitor lands on a
short Overview and has to leave it to see anything else. What was too
much on one page was the 29 figures laid out end to end, not the
sections. One page, with the Insights behind tabs that show one topic at
a time, keeps everything one scroll away and the figures out of the way
until asked for.

## What changes
- **One Explore page again.** `index.html` holds, in order: the hero and
  stats strip, the Overview (mixes and trends), the Session Explorer,
  the Insights, Cite and Team. `explorer.html` and `insights.html` go,
  with their modules and the old-link redirect; the header's four links
  are in-page anchors again (`#overview`, `#sessions`, `#insights`,
  `#cite`), the Session page's back link returns to `index.html#sessions`
  with the table's keys.
- **The Insights as tabs.** Under the Insights heading, one row of the six
  numbered topics; one topic is shown at a time and a click switches.
  The shown topic is in the URL's hash (`#insights-tokens`), so a link
  opens the Insights on that topic and Back returns to the previous one.
  A topic's figures are drawn when its tab is first shown, so every chart
  is drawn at its real width.
- **The Session Explorer's lines.** The line "A month holds the weeks
  whose Sunday falls in it" goes. A line under the heading says what a
  row does: "Click a session to open its requests, context and
  timeline."

## Impact
- Specs: `explore-page` (one page, the Insights' tabs, the table's
  lines), `site-repository` (navigation, layout, the deploy check),
  `session-page` (the back link), `week-selection` (the keys' page).
- Code: `site/index.html` (every section back), `site/explorer.html`
  and `site/insights.html` removed; `js/pages/overview.js`, `explorer.js`
  and `insights.js` become one `js/pages/explore.js`; `js/explore/topic_bar.js`
  becomes `js/explore/topic_tabs.js`; `js/landing/old_links.js` removed;
  `js/shared/layout.js`, `js/pages/session.js`, `js/explore/sessions_table.js`,
  `js/explore/figure_sections.js` (draw on show), `style.css`; the deploy
  workflow's check; README, CONTRIBUTING; the tests that follow.
- Data: no query changes; no `make data`.
