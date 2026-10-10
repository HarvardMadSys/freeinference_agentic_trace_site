# Spec Delta

## Purpose

The Parquet files the site reads: which rows and columns they hold, how they
are ordered, how big they may be, and how they are built from a release.

## ADDED Requirements

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

### Requirement: One file per kind of row, ordered by week
The step SHALL write `requests.parquet`, `tool_calls.parquet`,
`sessions.parquet` and `simulation.parquet`, and `weeks.json`. Every Parquet
file SHALL have a `week` column (the week's Sunday, `YYYY-MM-DD`) and SHALL be
sorted by week, then session, then step where those columns exist, in row
groups no larger than a named constant, so a query filtered by week or by
session reads only the row groups that hold them.

#### Scenario: Reading one week
- **WHEN** a query filters `requests` on one week
- **THEN** DuckDB SHALL skip every row group of the other weeks

### Requirement: Requests
`requests.parquet` SHALL hold one row per request of every session, subagent
sessions included, with these columns:
- from the release: `session_id, step, start_ms, end_ms, ttft_ms, model,
  provider, step_trigger, waited_for, prompt_tokens, completion_tokens,
  cache_read_tokens`, the role tokens as `system_tokens, user_tokens,
  assistant_tokens, tool_tokens, tool_definition_tokens`, `n_messages,
  finish_reason, transition, cause`;
- added, each computed by the pipeline's definition: `week`, `scope`,
  `is_top_level` (the session has no parent), `root_session_id` (the
  top-level session it belongs to, itself for a top-level session), `depth`
  (0 for a top-level session, 1 for its subagents, and so on), `turn`,
  `uncached_tokens`,
  `hit_ratio` (missing where the provider reports no cache reads), `wait_s`
  (missing at step 0), `idle_gap_s` and `idle_gap_bin` (missing where the
  pipeline's idle-gap definition gives none), `is_trusted_ttft`,
  `n_tool_calls`.

Definitions that look across weeks (the idle gap) SHALL be computed over all
weeks together, so a week's first requests get the same value as in the
paper.

#### Scenario: A request after a tool step
- **WHEN** a session's third request has `step_trigger = tool` and its first has `step_trigger = user`
- **THEN** its `turn` SHALL be 1 and its `wait_s` SHALL be its start minus the previous request's end, in seconds

### Requirement: Tool calls
`tool_calls.parquet` SHALL hold one row per tool call with `week, session_id,
step, call_index, name, category, outcome, result_tokens, latency_ms, scope,
is_top_level, root_session_id`. It SHALL NOT hold `arguments_skeleton` or `programs`.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 and the same `week`

### Requirement: Sessions
`sessions.parquet` SHALL hold one row per session, subagents included, with
`week, session_id, harness, scope, parent_session_id, spawned_by_step,
root_session_id, depth, user_id`, and per session, counting its own requests
only: `requests, user_steps, tool_steps, tool_calls, first_start_ms,
duration_s, input_tokens, cached_tokens, output_tokens, peak_prompt_tokens,
main_model` (the model of most of its requests, the first in name order on a
tie). A top-level session SHALL also hold `subagents` (its subagent sessions
at every depth) and `subagent_requests` (their requests).

#### Scenario: A subagent of a subagent
- **WHEN** top-level session T spawned subagent A, which spawned subagent B
- **THEN** B's `root_session_id` SHALL be T and its `depth` 2, and T's `subagents` SHALL be 2

#### Scenario: Totals agree with requests
- **WHEN** the requests of session S are summed
- **THEN** their count and token sums SHALL equal the session's `requests`, `input_tokens`, `cached_tokens` and `output_tokens`

### Requirement: Simulation tallies
`simulation.parquet` SHALL hold the cache simulation's per-week tallies
unchanged, with a `week` column added: `week, scope, policy, ttl,
hit_tokens, miss_tokens, reusable_token_seconds, dead_token_seconds`, and the
week's `active_token_seconds` from its totals. A week the simulation has not
yet covered SHALL have no rows, and `weeks.json` SHALL say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write the other files

### Requirement: Weeks index
`weeks.json` SHALL list every week, oldest first, as `{week, last_day,
month, simulated}`, where `month` (`YYYY-MM`) is the month of the week's
Sunday. It SHALL be small enough to load before DuckDB.

#### Scenario: A week that spans two months
- **WHEN** a week runs from 2026-05-31 to 2026-06-06
- **THEN** its `month` SHALL be `2026-05`

### Requirement: Size and contents
The data folder SHALL hold only the columns above, nothing from the trace
files, and no file larger than 100 MB. The step SHALL print each file's rows
and size.

#### Scenario: Publishing what the release publishes
- **WHEN** the data folder is compared with the release
- **THEN** every value in it SHALL be a release value or computed only from release values
