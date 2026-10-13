## MODIFIED Requirements

### Requirement: Simple code before fast or clever code
The code SHALL be simple, readable and maintainable first. A reader who did
not write it SHALL be able to follow any module on a first read.
- **No premature optimisation.** Caching, precomputing a summary, splitting a
  file or adding an index is done only after a measured run shows the plain
  version is too slow, and the measurement SHALL be recorded in the change's
  `design.md`.
- **Plain over clever.** No nested comprehensions, no lambdas or arrow
  functions longer than one expression, no state set on objects the code does
  not own, no side effects at import.
- **Names are words.** Variables say what a row is (`requests`, `sessions`,
  `weeks`). A one-letter name is only a loop index. Python modules are
  imported by name without aliases; JavaScript uses named imports.
- **One job per unit.** A function SHALL be at most 50 lines and a module at
  most 300 lines.
- **Docstrings and comments.** A module header says what the module holds
  and the shape of what crosses its boundary; an export's docstring states
  its definition; a comment inside a function says why, in one line. None
  refers to history, people or paper figure numbers, and none is cut to a
  count: a header over ten lines is reviewed for sentences a reader does
  not need.
- **SQL is a literal.** Each query, and the statements that create the views
  and selection tables, is one `.sql` file under `site/queries/` that names
  its columns in words. No SQL is written in JavaScript and no query is
  assembled from strings; the values a query depends on reach it through the
  selection tables defined in `week-selection`.

#### Scenario: A function that grew
- **WHEN** a Python or JavaScript function exceeds 50 lines
- **THEN** the line-count test SHALL fail until it is split

#### Scenario: An assembled query
- **WHEN** a JavaScript file holds a SQL statement
- **THEN** the test that scans `site/js/` for SQL statements SHALL fail

#### Scenario: A header that grew
- **WHEN** a module's header comment exceeds ten lines
- **THEN** the node test SHALL list it as a warning for review, and `make test` SHALL still pass

### Requirement: Tests
`make test` SHALL run the Python tests and `node --test`, and SHALL pass at
every commit. Every `.sql` file SHALL be run by a test against data built from
a small fixture release, with the selection tables filled, and SHALL return
the columns its chart reads. For every query that has a precomputed answer,
a test SHALL check that the answer written for the fixture equals the query
run live with the default selection. A snapshot test SHALL hold, under
`tests/snapshots/`, the normalised text of every chart, table, legend and text
block of twelve page states (the landing page with each topic shown, and
two fixed sessions, one of them with subagents, each in its three
views), compare them in headless Chromium on `make test`,
and be rewritten by `make snapshots` when a change is meant; it SHALL
skip, saying so, where Chromium is not installed, and fail, naming the
host, where the libraries or fonts cannot load.

#### Scenario: A query that no longer matches the data
- **WHEN** a column a query reads is renamed in the site data
- **THEN** `make test` SHALL fail on that query

#### Scenario: An answer that no longer matches its query
- **WHEN** the answer writer rounds, renames or drops a column the live query returns
- **THEN** `make test` SHALL fail on that query

#### Scenario: A chart that changed
- **WHEN** a figure's insight, a tick or a series colour changes without `make snapshots`
- **THEN** `make test` SHALL fail naming that chart

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, where the numbers come from, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, snapshots, deploy
wrangler.jsonc    the Cloudflare Worker that serves site/ as static assets
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest and Playwright (pinned) for tests
package.json      sets ES modules for node --test; wrangler, the one dev dependency; package-lock.json pins it
.nvmrc            the Node version the deploy workflow uses
.github/          workflows/deploy.yml: the deploy on every push to main
site_data/        builds site/data/ from a release folder: the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  favicon.svg     the brand mark, for the browser tab
  js/shared/      the answers, formatting, charts, the histogram, the CDF, the table, the layout
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's start and its sections: the trends, the session list, the figure sections, the topic tabs
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's bucket loader, address, agent tree, facts card, legends, token parts, and the views' chart start and request click
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, buckets, setup
  data/           built by make data and tracked: the indexes, the answers, the session buckets; a clone serves the site without building
tests/            Python tests, node --test files, and snapshots/: the twelve page states as text
openspec/         the specs and the open changes; archived changes live in git history
```

#### Scenario: Generated data is never committed
- **WHEN** `site/data` changes after `make data`
- **THEN** it SHALL be committed with the change that needed it, and the repository test SHALL require it whole and current
