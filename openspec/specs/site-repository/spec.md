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
package.json      sets ES modules for node --test; wrangler, to deploy
site_data/        builds site/data/ from a release folder: a file per kind and week, the indexes, the answers
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore), session, about
  style.css       tokens, layout and components
  js/shared/      the database, the selection, the libraries, formatting, the table, charts, the histogram card, the stat strip, the layout
  js/engine/      DuckDB in the page: starting it, its views and setup, the weeks' files and their streaming in
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/explore/     the Explore page's sections: trends, headline, distribution cards, sessions table
  js/figures/     one module per figure section, and the row rules every figure shares
  js/session/     the Session page's address, agent tree, facts, legends, overlap grouping and chart frame
  js/session_requests/  the Requests view: a row per request, its details, brackets and legend
  js/session_charts/    the Context and Timeline views and the series and bars they draw
  queries/        one .sql file per chart or table, in one folder per purpose (explore, figures, session, setup)
  data/           built by make data and tracked: a clone serves the site without building
tests/            Python tests and node --test files
openspec/
```

A folder holds one purpose and at most about eight modules; the repository test
fails on a folder under `site/js/` with more than nine.

#### Scenario: Generated data is never committed
- **WHEN** a file under `site/data/` is tracked by git
- **THEN** the repository test SHALL fail

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
Every page SHALL share one header linking Explore, its figure sections, its
sessions table and About, carrying the current selection in each link. The
About page SHALL say that the default selection is the paper's population
(every harness but the benchmark replay) and define session, top-level
session, subagent, request, step, turn, harness, transition, wait, idle gap
and gap bin in the pipeline's words, say how the
data were built and from which release, say which figures the site draws
more simply than the paper, and link to the paper, the dataset and the
pipeline repository.

#### Scenario: Moving between pages
- **WHEN** the visitor has selected July 2026 on Explore and opens About, then returns
- **THEN** Explore SHALL open with July 2026 selected

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
`make deploy` SHALL publish `site/`, including its generated data, to a
static host that answers HTTP range requests: the Cloudflare Worker that
`wrangler.jsonc` names, which serves `site/` as static assets. A push to
`main` SHALL deploy the same way through the host's Git integration.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

### Requirement: The built data ships with the repository
Git SHALL track `site/data` as `make data` built it: the week files of every
kind, the indexes, the answers and the query hashes. The shipped data SHALL
be whole, with a tracked row file per kind for every week in `weeks.json`,
and current, with every answer written from its query's current text;
`make test` SHALL fail otherwise. Rebuilding the data remains `make data`
from the pipeline repository, and the rebuilt data is committed with the
change that needed it.

#### Scenario: Serving a fresh clone
- **WHEN** the repository is cloned and `make serve` runs
- **THEN** every released week SHALL be shown without building anything

#### Scenario: A query edited without rebuilding
- **WHEN** the text of an answered query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: A week built but not added
- **WHEN** `weeks.json` names a week whose row file is not tracked
- **THEN** the repository test SHALL fail naming the file

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
keep their ratios to the base. The 360-pixel layout SHALL still fit without
horizontal scrolling.

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
the Explore page's module, `FIGURES_ARE_FROZEN`, true. With it true, the
Explore page SHALL load no DuckDB module and no Parquet file; with it
false, the page SHALL behave as the archived change `one-page-all-weeks`
specified.

#### Scenario: The switch on
- **WHEN** `FIGURES_ARE_FROZEN` is true and the Explore page is opened
- **THEN** no `.wasm` and no `.parquet` SHALL be fetched

#### Scenario: The switch off
- **WHEN** `FIGURES_ARE_FROZEN` is false
- **THEN** the week and harness pickers SHALL be mounted and a narrowed selection SHALL recompute the figures in the browser
