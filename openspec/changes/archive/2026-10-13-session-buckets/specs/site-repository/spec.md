## MODIFIED Requirements

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, check-answers, deploy
deploy.sh         what make deploy runs
serve.py          what make serve runs: a local server that answers range requests
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json      sets ES modules for node --test; no dependencies
docs/             differences.md: where the site draws more simply than the paper
site_data/        builds site/data/ from a release folder: a file per kind and week, the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  js/shared/      the database, the selection, the libraries, formatting, charts, the histogram, the CDF, the table, the layout
  js/engine/      DuckDB in the page, behind the Explore page's switch
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's sections and the session list
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

### Requirement: The browser query path is kept behind a switch
The code that lets the Explore page recompute its figures in the browser
(the pickers, the selection tables' filling, DuckDB's start, the stream)
SHALL stay in the repository with its tests, behind one named constant in
the Explore page's module, `FIGURES_ARE_FROZEN`, true. With it true, the
Explore page SHALL load no DuckDB module and no Parquet file; with it
false, the page SHALL behave as the archived change `one-page-all-weeks`
specified. The Session page SHALL have no DuckDB path: it reads its
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
