# Change: insights

## Why
The landing page reads as a paper's companion: a hero, the trace at a
glance, then "The paper's figures" and, at the bottom, a "Session list".
A visitor who is not reading the paper gets charts without their point.
The site should lead with what the trace shows: each chart carries its
insight in one short sentence, each topic its takeaway, and the sessions
a visitor can open come before the charts, since they are what makes this
site more than the paper.

## What changes
- **Order.** Hero, Overview, Sessions, Insights, Cite, Team, footer. The
  session list moves up under the Overview; the six topics follow it.
- **Names, as nouns.** Section headings are one or two words: Overview
  "At a glance", the list "Sessions" (eyebrow "Browse"), the topics
  "Insights" (eyebrow "Findings"), Cite "Citation". The header links read
  Overview, Sessions, Insights, Cite. The hero's primary button reads
  "Insights". Topic 01 becomes "Session structure" so the list and the
  topic do not share a name. Anchors: `#insights`, `#insights-sessions`
  … `#insights-comparison`; `#sessions` stays.
- **An insight per card.** Every figure card shows, under its title, one
  sentence of at most twelve words that says what the chart means, not
  what it draws: "Sessions are mostly idle time between turns." A number
  appears only when it is the insight ("Fifteen minutes of retention
  catches most reuse."). The caption and the Definition control stay.
- **A takeaway per topic.** One sentence of at most twenty words under
  each topic heading, the paper's finding for that topic in plain words.

## Impact
- Specs: `explore-page` (the list's position and name, the figures
  requirement renamed Insights with the insight and takeaway rules, the
  hero button), `site-repository` (navigation names).
- Code: `site/index.html`, `js/shared/layout.js`, `js/landing/hero.js`,
  `js/shared/charts.js` (the insight line), every figure module's entries
  (an `insight` field), `style.css`, the word-count test; README and
  CONTRIBUTING's figure entry pattern.
- Data: no query changes; no `make data`. No test checks the sentences
  against the data: they are claims the paper makes, kept short.
