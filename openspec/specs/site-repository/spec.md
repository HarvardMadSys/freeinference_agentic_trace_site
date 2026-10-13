# site-repository Specification

## Purpose
How the site's repository is laid out, the engineering rules all of its code
follows, what it depends on, and how it is tested and deployed.

## Requirements

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
  js/shared/      the answers, the libraries, formatting, charts, series, the table, the layout
  js/charts/      the seven chart kinds: cdf, stacked_bars, ranges, histogram, ranked, knee_lines, donut
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's start and its sections: the trends, the session list, the figure runner and its row rules, the legend, the topic tabs
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

### Requirement: No front-end build and no npm runtime dependency
The site SHALL be plain HTML, CSS and ES modules served as they are in
`site/`. It SHALL NOT need a bundler, a transpiler or `npm install` to run.
Browser libraries SHALL be loaded from a CDN at exact, pinned versions, and
every library URL SHALL be written once, in one module that the rest of the
code imports from.

#### Scenario: Serving the source folder
- **WHEN** `site/` (with its data) is served by any static file server
- **THEN** every page SHALL work without a build step

#### Scenario: A library URL outside its home
- **WHEN** a CDN URL appears in any file other than the one library module
- **THEN** the repository test SHALL fail

### Requirement: Definitions come from the pipeline
Every quantity the site shows SHALL be defined once, in the pipeline's public
packages, or be a plain count, sum, ratio of sums, or quantile of a column
the site data step wrote. The site SHALL NOT re-implement a definition the
pipeline already has (turn, scope, wait, hit ratio, uncached tokens, idle
gap).

#### Scenario: A new derived column
- **WHEN** a figure needs a per-request quantity that is not a release column
- **THEN** the site data step SHALL compute it by calling the pipeline's function, and the browser SHALL only read it

### Requirement: Navigation
The site SHALL have two pages, Explore (`index.html`, the landing page)
and Session (`session.html`).
Both SHALL share one sticky header: the brand "FreeInference Agentic
Dataset" linking to the Explore page, the in-page links Overview, Session Explorer,
Insights and Cite, and no link off the site. On a phone the header SHALL
be two rows, the brand on the first and the four links on the second,
wrapping as they need; nothing in the header SHALL scroll sideways or be
cut off. The header SHALL NOT name the lab nor link the
dataset, the paper, the code or Open Data; the hero and the footer do.
The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page and no About paragraph; the definitions live behind each card's control, the differences
from the paper in README's "Where the numbers come from", and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Session Explorer link
- **THEN** the Explore page SHALL open at the Session Explorer with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls any page
- **THEN** the header SHALL remain visible at the top

#### Scenario: The current page
- **WHEN** the visitor is on the Session page
- **THEN** the header's Session Explorer link SHALL be marked and the others not

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** all four links SHALL be visible under the brand without scrolling the header

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

### Requirement: Deployment
`make deploy` SHALL publish `site/`, including its generated data, to the
Cloudflare Worker that `wrangler.jsonc` names, which serves `site/` as
static assets. A push to
`main` SHALL deploy the same way through the repository's deploy workflow,
which SHALL then ask the published site for the Explore page (`/`), the
weeks index and the newest week's bucket index, and fail on any answer
but 200.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

#### Scenario: A page missing after a deploy
- **WHEN** the published site answers `/` with 404
- **THEN** the deploy workflow SHALL fail naming that path

### Requirement: The built data ships with the repository
Git SHALL track `site/data` as `make data` built it: the indexes, the
answers, the query hashes, and every week's session
buckets and bucket index. The shipped data SHALL be whole, with a tracked
bucket index for every week in
`weeks.json`, and current, with every answer written from its query's
current text; `make test` SHALL fail otherwise. Rebuilding the data
remains `make data` from the pipeline repository, and the rebuilt data is
committed with the change that needed it.

#### Scenario: Serving a fresh clone
- **WHEN** the repository is cloned and `make serve` runs
- **THEN** every released week SHALL be shown, and every session opened, without building anything

#### Scenario: A query edited without rebuilding
- **WHEN** the text of an answered or bucket query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: A week built but not added
- **WHEN** `weeks.json` names a week whose bucket index is not tracked
- **THEN** the repository test SHALL fail naming the file

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
be set in the display serif and keep their ratios to the base. The
360-pixel layout SHALL still fit without horizontal scrolling.

#### Scenario: The smallest text
- **WHEN** any page is opened at desktop width
- **THEN** the computed size of every text element SHALL be at least 14 px

#### Scenario: A phone
- **WHEN** the Explore page is opened 360 pixels wide
- **THEN** the page SHALL not scroll sideways

### Requirement: The look follows Open Data
The site SHALL use Open Data's tokens: the paper background `#f8f7f5`,
white surfaces, ink `#1c1917`, the rule `#e4dfdb`, the crimson accent
`#a51c30` with its dark and tint; Crimson Text for headings, the stat
numbers and the affiliation, Inter for body text, and the monospace
stack, uppercase and letter-spaced, for eyebrows, chips, the nav and the
cite caption. Cards SHALL carry a 1px rule, a soft shadow and a 0.9rem
radius. A dark scheme SHALL follow the visitor's system preference, with
the paper, surfaces and inks retuned dark. The eight series slots SHALL
be the same hues in both schemes, at least 30° apart in OKLCH, each at least 3:1 in
contrast against its scheme's card, and a test SHALL check every colour
token's contrast in both schemes. The parts of a session's time SHALL be
coloured as the paper colours them: prefill blue, decode orange, tool
green, user idle red.

#### Scenario: A heading
- **WHEN** any heading renders
- **THEN** its computed font family SHALL begin with Crimson Text

#### Scenario: Dark system scheme
- **WHEN** the visitor's system prefers a dark scheme
- **THEN** the page SHALL render on the dark paper with every series at least 3:1 against its card

#### Scenario: A series keeps its identity
- **WHEN** the same harness is drawn in light and in dark
- **THEN** it SHALL have the same hue in both
