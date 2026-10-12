# Proposal

## Why

The site works, but it does not yet say what it is. A visitor lands on a
lede and a wall of cards with no banner, no statement of the dataset, no
links to the paper, the data or the code, no citation and no credit. The
About page carries three thousand words nobody reads, and every card
carries a caption and a definition. The figures run in one long column
whose grouping does not read as a story: the Sessions section mixes
counts, tokens, cost and latency, and eight histograms repeat CDFs drawn a
screen later. The session list opens sorted by input tokens behind a
filter of harness pills nobody asked for, and the Session page spreads its
facts over eleven tiles and names a fourth token part, "no cache report".

The sibling site, Open Data (data.freeinference.org), shows the form to
follow: a hero with a title and buttons, a stats strip, cards with a
crimson rule, a team and citation section, and the Harvard footer, set in
Crimson Text and Inter on warm paper.

## What Changes

- **A landing page, not a page of cards.** The Explore page opens as a
  landing page in Open Data's form: a sticky header; a hero naming the
  dataset, with buttons to the figures, the Hugging Face dataset, the
  paper and the code; a stats strip computed from the data; the model
  mix as a donut; then the figures by section; then the session list;
  then Cite, Team and the Harvard footer. The About page goes.
- **Less text.** One caption of at most twelve words per card; a
  definition of at most forty words behind the control; no section
  intros; the population stated in the stats strip.
- **Figures regrouped by topic** into six sections: Sessions, Tokens and
  cost, Latency, Tools, Prefix caching, Human-driven against benchmark.
  The eight histogram cards go; the two with no CDF twin join their
  sections.
- **The session list** sorts by start date, newest first, filters by month
  only, shows every harness with the benchmark marked, and is restyled.
- **The Session page** shows its facts as one card with labelled fields
  beside the title, names three token parts (cached input, uncached
  input, output), and gets a time-range slider on the Context and
  Timeline views.
- **The look** takes Open Data's tokens: the paper background, the
  crimson accent, Crimson Text headings, Inter body, monospace eyebrows.
  Dark mode is dropped, as on Open Data.

## Impact

- `explore-page`: new landing requirements; figures regrouped; the
  headline and distribution requirements replaced; the session list.
- `session-page`: the facts card; the token parts; the range slider.
- `site-repository`: navigation without About; the sticky header; the
  look; the layout (about.html and its module go).
- `week-selection`: the session list's filter is months only.
- Files: index.html, session.html, style.css, js/pages, js/explore,
  js/shared/layout.js, js/session*, the figure modules' captions and
  definitions, the tests that pin the removed texts, README, CONTRIBUTING.
- No query and no data change: the stats strip and the donut read the
  existing answers.
