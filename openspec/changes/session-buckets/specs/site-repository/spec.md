## MODIFIED Requirements

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
