# Spec Delta

## Purpose

The data holds what the added figures and the Session page need: a
call's programs and argument shape, both scopes' simulation under one
policy with the span, a request's prompt tokens and infinite-retention
misses, and every harness's sessions in the table's answer.

## MODIFIED Requirements

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
`tool_calls.parquet` SHALL hold one row per tool call with `session_id,
step, call_index, name, category, programs, arguments_skeleton, outcome,
result_tokens, latency_ms, harness, is_top_level, root_session_id`.
`programs` SHALL be the release's list of program labels, in the command's
order, for a shell call, and null for any other call; `arguments_skeleton`
SHALL be the release's, the call's arguments with every value replaced by
its type.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 in the same week's file

#### Scenario: A native call
- **WHEN** a tool call is not a shell call
- **THEN** its `programs` SHALL be null and its `arguments_skeleton` SHALL still be kept

### Requirement: Simulation tallies
`simulation.parquet` SHALL hold the cache simulation's per-week tallies of
both scopes, the paper's Agentic population and the benchmark's, under the
TTL-only policy unchanged: `scope, ttl, hit_tokens, miss_tokens,
reusable_token_seconds, dead_token_seconds`, and the scope's
`active_token_seconds`, `span_seconds` and `output_tokens` from the week's
totals. It SHALL NOT hold the other eviction policies. A week the
simulation has not yet covered SHALL have no file, and `weeks.json` SHALL
say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write the other files

#### Scenario: The span
- **WHEN** week W's totals give the Agentic scope a span of S seconds
- **THEN** every Agentic simulation row of W SHALL carry `span_seconds` S

### Requirement: Precomputed answers for the default selection
`make data` SHALL run every query under `queries/explore/` and
`queries/figures/`, and the colour orders under `queries/setup/`, once
with every week and every non-benchmark harness in the selection tables,
and write each answer as `site/data/all_weeks/<page>/<query>.json`, with
the hash of each query's text in `all_weeks/queries.json`. The sessions
table's answer SHALL be the one exception: it SHALL hold every harness's
top-level sessions, the benchmark's marked, so the table can be filtered
to any harness in the browser. The step SHALL print each answer's rows and
size, and the Explore page SHALL draw from the answers alone.

#### Scenario: A query edited after the data was built
- **WHEN** the text of an answered query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: The table's answer
- **WHEN** the sessions-table answer is written
- **THEN** it SHALL hold the benchmark harness's sessions with `benchmark` true, and the other harnesses' with it false
