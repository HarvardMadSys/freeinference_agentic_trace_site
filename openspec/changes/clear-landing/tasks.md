# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px. No query and no data
change is expected; if one is needed, `make data` and commit `site/data`.

## 1. The look and the frame

- [ ] 1.1 Tokens and typography: Open Data's palette and fonts in `style.css`, light only (`color-scheme: light`, the dark block removed), the monospace eyebrow style, card rule and radius; nothing under 14 px; `tests/colours.test.js` and the repository test follow.
- [ ] 1.2 The sticky header with the brand, the affiliation, the in-page and external links; scroll margins on every anchored section; the Open Data footer. `tests/layout.test.js` follows.

## 2. The landing page

- [ ] 2.1 The hero (eyebrow, title with the crimson phrase, lede, four buttons) and the stats strip beside it, its numbers from the shipped answers and tested; the headline tiles and the population line go.
- [ ] 2.2 The Overview: the model-mix donut from the `explore/model_mix` answer (eight named, Other) and the harness-mix donut from the sessions-per-week answer, with the shared colour orders and legends that toggle; the model-mix chips go; then the three trend cards.
- [ ] 2.3 Cite (the paper's BibTeX with a copy button), Team (the authors, Harvard MadSys, the About paragraph with its links) and the footer, as the design lists; `site/about.html`, `js/pages/about.js` and `tests/test_about_page.py` go; "where the site draws more simply" moves to `docs/differences.md`; the restating-queries check moves into `tests/test_pipeline_mirrors.py`; README and CONTRIBUTING follow.

## 3. Figures regrouped and trimmed

- [ ] 3.1 Six sections as the design lists, the figure modules composed accordingly (one composing module per section; folders under nine modules); the distribution cards go except "Subagents per session" and "Cached fraction per request", which join Sessions and Tokens and cost as cards; header links and `index.html` follow.
- [ ] 3.2 Every caption at most twelve words and every definition at most forty, counted by `tests/figure_sections.test.js`; no section intro.

## 4. The session list

- [ ] 4.1 Default sort by start date descending; one row of form controls: month, harness and model drop-downs, the search box and the minimum-requests field; the pills, buttons and folded disclosure gone; every harness listed by default with the benchmark marked in its cell and named in the drop-down; URL keys `months` and `harnesses` hold one value each; the columns as the design lists; a sticky header row; the table restyled to the look. `tests/explore_sessions_*.test.js` follow.

## 5. The Session page

- [ ] 5.1 The facts card beside the title with labelled fields; the tiles go; `tests/facts.test.js` follows.
- [ ] 5.2 Three token parts everywhere on the page (cached input, uncached input, output; unreported cache counted as uncached); the Requests bar, legend, details and the Context areas and tooltips; the ten pinned tests follow.
- [ ] 5.3 The range slider on the Context and Timeline views: a brush strip under the chart setting the x domain and redrawing; `elapsedTicks` over a start and an end; node tests of the range arithmetic.

## 6. Done

- [ ] 6.1 Browser check of every page at 1280 and 360 px; README's measurements refreshed; `openspec validate --strict`.
- [ ] 6.2 Deploy checks (carried): once the site has a GitHub repository, `make deploy`, a range request answered with 206 on the host, and the deployed pages checked end to end.
