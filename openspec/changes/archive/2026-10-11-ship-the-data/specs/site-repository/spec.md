# Spec Delta

## Purpose

A clone of the repository serves the site as it is.

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

## ADDED Requirements

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
