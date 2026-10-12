# Change: insights

## Why
The landing page reads as a paper's companion: a hero, the trace at a
glance, then "The paper's figures" and, at the bottom, a "Session list".
A visitor who is not reading the paper gets charts without their point.
The site should lead with what the trace shows: each chart carries its
finding in one line, each topic its takeaway in one sentence, and the
sessions a visitor can open come before the charts, since they are what
makes this site more than the paper.

## What changes
- **Order.** Hero, Overview, the sessions (renamed), the findings
  (renamed), Cite, Team, footer. The session list moves up under the
  Overview; the six figure topics follow it.
- **Names.** The figures section is "Findings" (eyebrow "Findings",
  heading "What the trace shows"); the list is "Sessions" (eyebrow
  "Sessions", heading "Browse every session"); the first topic becomes
  "Session structure" so the list and the topic do not share a name. The
  header links read Overview, Sessions, Findings, Cite. The hero's primary
  button reads "Explore the findings". Anchors follow: `#findings`,
  `#findings-sessions` … `#findings-comparison`; `#sessions` stays.
- **A finding per card.** Every figure card shows, under its title, one
  finding line of at most sixteen words: a number-led claim the chart
  supports, in the style of a results page ("**Median turn 61 s, median
  session 30 min**: sessions are idle time between turns."). The caption
  and the Definition control stay as they are.
- **A takeaway per topic.** Each of the six topic headings carries one
  sentence of at most twenty-five words, the paper's finding for that
  topic in plain words.
- **Numbers are tested.** Every number a finding states is read from the
  figure's answer by a named function and checked by a test, so a data
  refresh that moves a number fails `make test` instead of leaving a
  stale claim; a finding whose number the answer cannot yield states no
  number.

## Impact
- Specs: `explore-page` (sessions table position and name, the figures
  requirement renamed Findings with the finding and takeaway rules, the
  hero button), `site-repository` (navigation names).
- Code: `site/index.html`, `js/shared/layout.js`, `js/landing/hero.js`,
  `js/shared/charts.js` (the finding line), every figure module's entries
  (a `finding` field and its numbers function), `style.css`, the tests
  and a new `tests/findings.test.js`; README and CONTRIBUTING's figure
  entry pattern.
- Data: no query changes; no `make data`.
