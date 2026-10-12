## ADDED Requirements

### Requirement: Session buckets
`make data` SHALL write, for each week, the rows of every top-level
session and its subagents into `session_buckets/<week>/<xx>.json.gz`,
`xx` the first two characters of the top-level session id, as an object
from top-level id to `{tree, requests, tool_calls}` in the answers'
column-and-rows shape, the columns those of `queries/buckets/`; and
`session_buckets/<week>/index.json.gz` from every session id of the week,
subagents included, to its top-level id. Both SHALL be gzipped with a
fixed modification time, so that a rebuild of the same rows writes the
same bytes. A prefix with no session in a week SHALL have no file. The
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

### Requirement: Trace totals answer
`make data` SHALL write `all_weeks/explore/trace_totals.json`, run like the
sessions table's answer over every week and every harness: one row with
the top-level sessions, requests, input tokens, tool calls and harnesses
of the whole trace, and the benchmark replay's sessions, requests and
harnesses among them.

#### Scenario: The whole trace
- **WHEN** the answer is written
- **THEN** its sessions SHALL equal the Session Explorer's row count and its benchmark sessions the rows marked benchmark

## MODIFIED Requirements

### Requirement: Size and contents
The data folder SHALL hold only the columns above, the two indexes, the
precomputed answers and the session buckets with their indexes, nothing
from the trace files, and no file larger than 25 MiB. The step SHALL
print each kind's rows and size over every week, the answers folder's
size, and the buckets' count and size.

#### Scenario: Publishing what the release publishes
- **WHEN** the data folder is compared with the release
- **THEN** every value in it SHALL be a release value or computed only from release values
