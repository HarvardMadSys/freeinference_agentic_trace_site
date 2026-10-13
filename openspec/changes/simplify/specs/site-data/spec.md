## REMOVED Requirements

### Requirement: One file per kind of row, ordered by week
**Reason**: Nothing served reads the row files; the build reads its own frames.
**Migration**: `make data` registers the four frames with DuckDB in memory and writes only the indexes, the answers and the buckets. The dataset's rows stay published by the pipeline repository and the Hugging Face dataset.

## MODIFIED Requirements

### Requirement: Size and contents
The data folder SHALL hold only the two indexes, the
precomputed answers and the session buckets with their indexes, nothing
from the trace files and no row file, and no file larger than 25 MiB. The step SHALL
print the answers' files and size, and the buckets' count and size.

#### Scenario: Publishing what the release publishes
- **WHEN** the data folder is compared with the release
- **THEN** every value in it SHALL be a release value or computed only from release values

#### Scenario: No row file
- **WHEN** `make data` has run
- **THEN** `site/data` SHALL hold no `.parquet` file

### Requirement: Precomputed answers for the default selection
`make data` SHALL run every query under `queries/explore/` and
`queries/figures/`, and the colour orders under `queries/setup/`, over
the release's rows held as frames in memory, once
with every week and every non-benchmark harness in the selection tables,
and write each answer as `site/data/all_weeks/<page>/<query>.json`, with
the hash of each query's text in `all_weeks/queries.json`. The Explore
queries (the Overview's mixes and trends, the sessions table's, its
first page's and the trace totals') SHALL be answered with every
harness, the benchmark's marked in the table's answer, so the table can
be filtered to any harness in the browser. Every query under
`queries/explore/` SHALL be read by a page. The step SHALL print the answers' files and
size, and the Explore page SHALL draw from the answers alone.

#### Scenario: An answer equals the live query
- **WHEN** a query is run in Python with every week and the paper's harnesses selected
- **THEN** its rows SHALL equal the rows of its answer file, column for column

#### Scenario: A query file without an answer
- **WHEN** a page asks for an answer file that does not exist
- **THEN** the page SHALL show that query's error in its own place

#### Scenario: A query edited after the data was built
- **WHEN** the text of an answered query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: The table's answer
- **WHEN** the sessions-table answer is written
- **THEN** it SHALL hold the benchmark harness's sessions with `benchmark` true, and the other harnesses' with it false

#### Scenario: A week without a simulation
- **WHEN** a release week has no simulation rows
- **THEN** the simulated answers SHALL still be written, from the other weeks' rows

### Requirement: Session buckets
`make data` SHALL write, for each week, the rows of every top-level
session and its subagents into `session_buckets/<week>/<xx>.json.gz`,
`xx` the first two characters of the top-level session id, as an object
from top-level id to `{tree, requests, tool_calls}`, each part
`{columns, rows}` with the columns of its query under `queries/buckets/`
less `root_session_id` (the key) and each row its values in column
order; and
`session_buckets/<week>/index.json.gz` from every session id of the week,
subagents included, to its top-level id. Both SHALL be written with
sorted keys, the queries' row order and a gzip header without a time, so
that a rebuild of the same rows writes the
same bytes; `site_data/buckets.py`'s docstring is the format's one
statement. A prefix only subagents' ids start with SHALL have an empty
bucket; a prefix no session id of the week starts with SHALL have no
file. The
bucket queries SHALL be hashed in `queries.json` as the answers' are. The
step SHALL print the buckets' count and size.

#### Scenario: A session's rows
- **WHEN** a bucket holds top-level session S
- **THEN** its `requests` rows SHALL equal `week_requests.sql`'s rows for S and its subagents, ordered by session and step

#### Scenario: The same bytes twice
- **WHEN** `make data` runs twice on the same release
- **THEN** every bucket and index SHALL be byte-identical between the runs

#### Scenario: A bucket query edited after the data was built
- **WHEN** the text of a bucket query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query
