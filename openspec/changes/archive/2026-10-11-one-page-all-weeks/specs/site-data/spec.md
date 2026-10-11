# Spec Delta

## Purpose

The Parquet files the site reads, one per kind of row and week so a week
can be fetched whole, every row of the release kept, a harness index, and
the precomputed answers of every selection query for the default selection.

## MODIFIED Requirements

### Requirement: One file per kind of row, ordered by week
The step SHALL write, for each of the four kinds of row (`requests`,
`tool_calls`, `sessions`, `simulation`), one Parquet file per week at
`<kind>/week=<sunday>/rows.parquet`, with `weeks.json`, `harnesses.json`
and the folder `all_weeks/` beside them. The week SHALL be read from the
folder name. Each file SHALL be sorted by session, then step where those
columns exist, in row groups no larger than a named constant, so a query
filtered by week opens only that week's file and a query filtered by
session reads only the row groups that hold it. The files SHALL hold every
session of the release, the benchmark's included.

#### Scenario: Reading one week
- **WHEN** a query filters `requests` on one week
- **THEN** DuckDB SHALL open that week's file only

#### Scenario: Fetching one week
- **WHEN** the browser fetches `requests/week=2026-08-09/rows.parquet`
- **THEN** it SHALL hold every request of that week's sessions and nothing else

### Requirement: Requests
`requests.parquet` SHALL hold one row per request of every session, subagent
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
  `n_tool_calls`.

Definitions that look across weeks (the idle gap) SHALL be computed over all
weeks together, so a week's first requests get the same value as in the
paper; the idle gap SHALL be computed over the paper's Agentic top-level
requests as the paper computes it, and over the benchmark's top-level
requests apart, and a subagent's request SHALL have none.

#### Scenario: A request after a tool step
- **WHEN** a session's third request has `step_trigger = tool` and its first has `step_trigger = user`
- **THEN** its `turn` SHALL be 1 and its `wait_s` SHALL be its start minus the previous request's end, in seconds

### Requirement: Tool calls
`tool_calls.parquet` SHALL hold one row per tool call with `session_id,
step, call_index, name, category, outcome, result_tokens, latency_ms,
harness, is_top_level, root_session_id`. It SHALL NOT hold `arguments_skeleton` or `programs`.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 in the same week's file

### Requirement: Sessions
`sessions.parquet` SHALL hold one row per session, subagents included, with
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
`simulation.parquet` SHALL hold the cache simulation's per-week tallies of
the paper's Agentic population unchanged: `policy, ttl, hit_tokens,
miss_tokens, reusable_token_seconds, dead_token_seconds`, and the week's
`active_token_seconds` and `output_tokens` from its totals. A week the
simulation has not yet covered SHALL have no file, and `weeks.json` SHALL
say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write the other files

### Requirement: Size and contents
The data folder SHALL hold only the columns above, the two indexes and the
precomputed answers, nothing from the trace files, and no file larger than
100 MB. The step SHALL print each kind's rows and size over every week, and
the answers folder's size.

#### Scenario: Publishing what the release publishes
- **WHEN** the data folder is compared with the release
- **THEN** every value in it SHALL be a release value or computed only from release values

## ADDED Requirements

### Requirement: Harness index
`harnesses.json` SHALL list every harness of the release, most sessions
first, as `{harness, sessions, benchmark}`, where `sessions` counts its
top-level sessions over every week and `benchmark` is whether the pipeline's
population puts it in the benchmark scope. It SHALL be small enough to load
before DuckDB.

#### Scenario: The benchmark harness
- **WHEN** the release holds `eval:swe-bench` sessions
- **THEN** `harnesses.json` SHALL list `eval:swe-bench` with `benchmark: true` and every other harness with `benchmark: false`

### Requirement: Precomputed answers for the default selection
After writing the Parquet files, the step SHALL run every `.sql` file under
`site/queries/explore/` and `site/queries/figures/` against them in DuckDB,
with `selected_weeks` holding every week and `selected_harnesses` every
harness that is not the benchmark, and write each answer to
`site/data/all_weeks/<page>/<query>.json` as a list of row objects whose
column names and values are what the browser's query would return. Every
query under `figures/` is answered, including those only the parity tests
run. The colour orders `setup/category_order`, `setup/harness_order`,
`setup/model_order` and `setup/provider_order`, which read every week and
every harness whatever the selection, SHALL be answered too, under
`all_weeks/setup/`. It SHALL write nothing for the `session` queries and the
other `setup` statements. Rebuilding from the same release SHALL write
identical answers.

#### Scenario: An answer equals the live query
- **WHEN** a query is run in the browser with the default selection
- **THEN** its rows SHALL equal the rows of its answer file, column for column

#### Scenario: A query file without an answer
- **WHEN** a page asks for an answer file that does not exist
- **THEN** the page SHALL show that query's error in its own place
