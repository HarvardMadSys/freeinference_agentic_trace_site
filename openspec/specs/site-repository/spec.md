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
- **Docstrings and comments.** A docstring or leading comment states a
  definition; a comment explains why. Neither refers to history, people or
  paper figure numbers.
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

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, check-answers, deploy
wrangler.jsonc    the Cloudflare Worker that serves site/ as static assets
serve.py          what make serve runs: a local server that answers range requests
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json      sets ES modules for node --test; wrangler, the one dev dependency
docs/             differences.md: where the site draws more simply than the paper
site_data/        builds site/data/ from a release folder: a file per kind and week, the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  favicon.svg     the brand mark, for the browser tab
  js/shared/      the database, the selection, the libraries, formatting, charts, the histogram, the CDF, the table, the layout
  js/engine/      DuckDB in the page, behind the Explore page's switch
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's start and its sections: the trends, the session list, the figure sections, the topic tabs, the pickers
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's bucket loader, address, agent tree, facts card, legends, overlap grouping, token parts and chart frame
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, buckets, setup
  data/           built by make data and tracked, the session buckets included: a clone serves the site without building
tests/            Python tests and node --test files
openspec/
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

### Requirement: Navigation and the About page
The site SHALL have two pages, Explore (`index.html`, the landing page)
and Session (`session.html`).
Both SHALL share one sticky header: the brand "FreeInference Agentic
Dataset" linking to the Explore page, the in-page links Overview, Session Explorer,
Insights and Cite, and no link off the site (on a phone, the brand and the
four links on one row that scrolls sideways, its right edge faded while
more links lie beyond it). The header SHALL NOT name the lab nor link the
dataset, the paper, the code or Open Data; the hero and the footer do. The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page and no About paragraph; the definitions live behind each card's control, the differences
from the paper in the repository's `docs/differences.md`, and the credits
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

### Requirement: Tests
`make test` SHALL run the Python tests and `node --test`, and SHALL pass at
every commit. Every `.sql` file SHALL be run by a test against data built from
a small fixture release, with the selection tables filled, and SHALL return
the columns its chart reads. For every query that has a precomputed answer,
a test SHALL check that the answer written for the fixture equals the query
run live with the default selection.

#### Scenario: A query that no longer matches the data
- **WHEN** a column a query reads is renamed in the site data
- **THEN** `make test` SHALL fail on that query

#### Scenario: An answer that no longer matches its query
- **WHEN** the answer writer rounds, renames or drops a column the live query returns
- **THEN** `make test` SHALL fail on that query

### Requirement: Deployment
`make deploy` SHALL publish `site/`, including its generated data, to the
Cloudflare Worker that `wrangler.jsonc` names, which serves `site/` as
static assets. The host answers a range request with the whole file; the
Session page SHALL work on such a host, reading its week's files whole. A push to
`main` SHALL deploy the same way through the repository's deploy workflow,
which SHALL then ask the published site for the Explore page (`/`) and
one data file, and fail on any answer but 200.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

#### Scenario: A page missing after a deploy
- **WHEN** the published site answers `/` with 404
- **THEN** the deploy workflow SHALL fail naming that path

### Requirement: The built data ships with the repository
Git SHALL track `site/data` as `make data` built it: the week files of every
kind, the indexes, the answers, the query hashes, and every week's session
buckets and bucket index. The shipped data SHALL be whole, with a tracked
row file per kind and a tracked bucket index for every week in
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
- **WHEN** `weeks.json` names a week whose row file or bucket index is not tracked
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

### Requirement: The browser query path is kept behind a switch
The code that lets the Explore page recompute its figures in the browser
(the pickers, the selection tables' filling, DuckDB's start, the stream)
SHALL stay in the repository with its tests, behind one named constant in
the Explore page's start module, `FIGURES_ARE_FROZEN`, true. With it true, the
Explore page SHALL load no DuckDB module and no Parquet file; with it
false, the page SHALL mount the pickers and recompute its sections
as the archived change `one-page-all-weeks` specified. The
Session page SHALL have no DuckDB path: it reads its
session from a bucket, and the database module SHALL keep no code only
the Session page used.

#### Scenario: The switch on
- **WHEN** `FIGURES_ARE_FROZEN` is true and the Explore page is opened
- **THEN** no `.wasm` and no `.parquet` SHALL be fetched

#### Scenario: The switch off
- **WHEN** `FIGURES_ARE_FROZEN` is false
- **THEN** the week and harness pickers SHALL be mounted and a narrowed selection SHALL recompute the figures in the browser

#### Scenario: The Session page
- **WHEN** any session is opened
- **THEN** no `.wasm`, `.parquet` or `.sql` SHALL be fetched, whatever the switch

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
