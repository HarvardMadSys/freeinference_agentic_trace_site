# site-data Specification

## Purpose
The Parquet files the site reads: which rows and columns they hold, how they
are ordered, how big they may be, and how they are built from a release.

## Requirements

### Requirement: Built from a release folder
`python -m site_data --release <dir> --simulation <dir> --out site/data`
SHALL read every week of a release folder in the layout the pipeline
publishes (`<dir>/<week>/` with `requests.parquet`, `tool_calls.parquet`,
`sessions.parquet`, `manifest.json`), check each week through the pipeline's
reader, and write the files below. It SHALL never read `block_ids` or the
trace files. Rebuilding from the same release SHALL write identical files.

#### Scenario: A week whose hashes do not match its manifest
- **WHEN** a week's table does not match the sha256 in its `tables.json`
- **THEN** the step SHALL stop with a message naming the week and write nothing

#### Scenario: Rebuilding
- **WHEN** the step runs twice on the same release
- **THEN** the two runs' files SHALL be byte for byte identical

### Requirement: Requests
The `requests` frame SHALL hold one row per request of every session, subagent
sessions included, with these columns:
- from the release: `session_id, step, start_ms, end_ms, ttft_ms, model,
  provider, step_trigger, waited_for, prompt_tokens, completion_tokens,
  cache_read_tokens`, the role tokens as `system_tokens, user_tokens,
  assistant_tokens, tool_tokens, tool_definition_tokens`, `n_messages,
  finish_reason, transition, cause`;
- added, each computed by the pipeline's definition: `harness`,
  `is_top_level` (the session has no parent), `root_session_id` (the
  top-level session it belongs to, itself for a top-level session), `depth`
  (0 for a top-level session, 1 for its subagents, and so on), `turn`,
  `uncached_tokens`,
  `hit_ratio` (missing where the provider reports no cache reads), `wait_s`
  (missing at step 0), `idle_gap_s` and `idle_gap_bin` (missing where the
  pipeline's idle-gap definition gives none), `is_trusted_ttft`,
  `n_tool_calls`, `user_prompt_tokens` (the tokens of a user step's new
  prompt, by the pipeline's function; missing for a tool step) and
  `missed_tokens_no_ttl` (the tokens the request missed with no TTL in the
  simulation, joined from its per-request misses; missing in a week
  without a simulation).

Definitions that look across weeks (the idle gap) SHALL be computed over all
weeks together, so a week's first requests get the same value as in the
paper; the idle gap SHALL be computed over the paper's Agentic top-level
requests as the paper computes it, and over the benchmark's top-level
requests apart, and a subagent's request SHALL have none.

#### Scenario: A request after a tool step
- **WHEN** a session's third request has `step_trigger = tool` and its first has `step_trigger = user`
- **THEN** its `turn` SHALL be 1 and its `wait_s` SHALL be its start minus the previous request's end, in seconds

#### Scenario: A user step's prompt
- **WHEN** a request is a user step whose new prompt the pipeline counts at 42 tokens
- **THEN** its `user_prompt_tokens` SHALL be 42, and the next tool step's SHALL be missing

#### Scenario: A request's misses
- **WHEN** the simulation's per-request misses give a request 1,500 tokens
- **THEN** its `missed_tokens_no_ttl` SHALL be 1500

### Requirement: Tool calls
The `tool_calls` frame SHALL hold one row per tool call with `session_id,
step, call_index, name, category, programs, arguments_skeleton, outcome,
result_tokens, latency_ms, harness, is_top_level, root_session_id`.
`programs` SHALL be the release's list of program labels, in the command's
order, for a shell call, and null for any other call; `arguments_skeleton`
SHALL be the release's, the call's arguments with every value replaced by
its type.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 in the same week

#### Scenario: A native call
- **WHEN** a tool call is not a shell call
- **THEN** its `programs` SHALL be null and its `arguments_skeleton` SHALL still be kept

### Requirement: Sessions
The `sessions` frame SHALL hold one row per session, subagents included, with
`session_id, harness, parent_session_id, spawned_by_step,
root_session_id, depth, user_id`, and per session, counting its own requests
only: `requests, user_steps, tool_steps, tool_calls, first_start_ms,
duration_s, input_tokens, reported_input_tokens` (the input tokens of the
requests whose provider reports cache reads), `cached_tokens` (their cache
reads), `output_tokens, peak_prompt_tokens, main_model` (the model of most of its requests, the first in name order on a
tie). A top-level session SHALL also hold `subagents` (its subagent sessions
at every depth) and `subagent_requests` (their requests).

#### Scenario: A subagent of a subagent
- **WHEN** top-level session T spawned subagent A, which spawned subagent B
- **THEN** B's `root_session_id` SHALL be T and its `depth` 2, and T's `subagents` SHALL be 2

#### Scenario: Totals agree with requests
- **WHEN** the requests of session S are summed
- **THEN** their count and token sums SHALL equal the session's `requests`, `input_tokens`, `cached_tokens` and `output_tokens`

### Requirement: Simulation tallies
The `simulation` frame SHALL hold the cache simulation's per-week tallies of
both scopes, the paper's Agentic population and the benchmark's, under the
TTL-only policy unchanged: `scope, ttl, hit_tokens, miss_tokens,
reusable_token_seconds, dead_token_seconds`, and the scope's
`span_seconds` and `output_tokens` from the week's
totals. It SHALL NOT hold the other eviction policies. A week the
simulation has not yet covered SHALL contribute no rows, and `weeks.json` SHALL
say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write every answer and bucket

#### Scenario: The span
- **WHEN** week W's totals give the Agentic scope a span of S seconds
- **THEN** every Agentic simulation row of W SHALL carry `span_seconds` S

### Requirement: Weeks index
`weeks.json` SHALL list every week, oldest first, as `{week, last_day,
month, simulated}`, where `month` (`YYYY-MM`) is the month of the week's
Sunday. Every page SHALL read it; the Explore page before any answer.

#### Scenario: A week that spans two months
- **WHEN** a week runs from 2026-05-31 to 2026-06-06
- **THEN** its `month` SHALL be `2026-05`

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

### Requirement: Harness index
`harnesses.json` SHALL list every harness of the release, most sessions
first, as `{harness, sessions, benchmark}`, where `sessions` counts its
top-level sessions over every week and `benchmark` is whether the pipeline's
population puts it in the benchmark scope. The Explore page SHALL read it, with
`weeks.json`, before any answer.

#### Scenario: The benchmark harness
- **WHEN** the release holds `eval:swe-bench` sessions
- **THEN** `harnesses.json` SHALL list `eval:swe-bench` with `benchmark: true` and every other harness with `benchmark: false`

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

### Requirement: Trace totals answer
`make data` SHALL write `all_weeks/explore/trace_totals.json`, run like the
sessions table's answer over every week and every harness: one row with
the top-level sessions, requests, input tokens, tool calls and harnesses
of the whole trace, and how many of the harnesses are the benchmark's.

#### Scenario: The whole trace
- **WHEN** the answer is written
- **THEN** its sessions SHALL equal the Session Explorer's row count
