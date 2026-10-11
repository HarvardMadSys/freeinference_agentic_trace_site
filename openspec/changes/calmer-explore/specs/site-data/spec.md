# Spec Delta

## Purpose

Tool calls keep their programs; the simulation rows keep one policy and
the week's span.

## MODIFIED Requirements

### Requirement: Tool calls
`tool_calls.parquet` SHALL hold one row per tool call with `session_id,
step, call_index, name, category, programs, outcome, result_tokens,
latency_ms, harness, is_top_level, root_session_id`. `programs` SHALL be
the release's list of program labels, in the command's order, for a shell
call, and null for any other call. It SHALL NOT hold `arguments_skeleton`.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 in the same week's file

#### Scenario: A native call
- **WHEN** a tool call is not a shell call
- **THEN** its `programs` SHALL be null

### Requirement: Simulation tallies
`simulation.parquet` SHALL hold the cache simulation's per-week tallies of
the paper's Agentic population under the TTL-only policy unchanged: `ttl,
hit_tokens, miss_tokens, reusable_token_seconds, dead_token_seconds`, and
the week's `active_token_seconds`, `span_seconds` and `output_tokens` from
its totals. It SHALL NOT hold the other eviction policies. A week the
simulation has not yet covered SHALL have no file, and `weeks.json` SHALL
say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write the other files

#### Scenario: The span
- **WHEN** week W's totals give a span of S seconds
- **THEN** every simulation row of W SHALL carry `span_seconds` S
