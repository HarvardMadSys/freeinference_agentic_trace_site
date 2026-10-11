# Spec Delta

## Purpose

The Explore page draws the paper's figures over the paper's data from
precomputed answers, and lets the visitor filter the sessions table.

## REMOVED Requirements

### Requirement: Figures draw when in view and redraw on selection change
**Reason**: no figure is recomputed in the browser; the answers are small
and every figure draws at once.
**Migration**: none.

## MODIFIED Requirements

### Requirement: Paper figures
Between the distribution cards and the sessions table, the Explore page
SHALL draw these figures from the answers `make data` precomputed over
every week and the paper's harnesses, in three sections, each figure with
its definition beside it:

| Section | Figure | What it plots |
|---|---|---|
| Sessions | `requests_per_session_cdf` | CDF over sessions of requests, user steps and tool steps |
| Sessions | `duration_cdf` | CDF of turn durations and of session durations, in seconds |
| Sessions | `tokens_per_request_cdf` | CDF over requests of input, uncached input and output tokens |
| Sessions | `cost_share_by_session` | Each session's cost split between cached input, uncached input and output at the pipeline's prices, sessions ranked by cached share, in rank bins |
| Sessions | `token_split_by_week` | Per week: the share of cached input, uncached input and output in all tokens |
| Sessions | `token_growth_by_messages` | Median cached, uncached and output tokens per bin of messages in the request |
| Sessions | `context_share_by_role` | Share of input held by system, user, assistant, tool results and tool definitions, per bin of input size |
| Sessions | `ttft_cdf_by_model` | CDF of TTFT per model, for the five models with most requests among the eight with most requests over every week, trusted TTFTs only |
| Sessions | `decode_cdf_by_model` | CDF of latency minus TTFT per model, for the same models and requests |
| Sessions | `session_time_by_part` | Each session's time split between model time, tool waits and human waits, sessions ranked by human share, in rank bins |
| Sessions | `speedup_if_twice_as_fast` | The session-time speed-up if prefill, decode or tool time alone ran twice as fast, with tool gaps capped as the pipeline caps them |
| Sessions | `turn_duration_by_scope` | CDF of turn duration, human-driven against benchmark, both medians and their ratio |
| Sessions | `session_duration_by_scope` | CDF of session duration, human-driven against benchmark |
| Sessions | `input_per_request_by_scope` | CDF of input tokens per request, human-driven against benchmark |
| Sessions | `user_prompt_tokens_by_scope` | CDF of a user's new prompt's tokens, human-driven against benchmark |
| Tools | `latency_by_category` | 5th, 25th, 50th, 75th, 95th percentile of latency per category |
| Tools | `result_tokens_by_category` | The same percentiles of result tokens per category |
| Tools | `calls_per_request_by_category` | Mean calls per request, by the category of the request's first call |
| Tools | `latency_by_batch_width` | Quantile band of the tool wait by the number of calls in the request, and the serial line |
| Tools | `tool_mix_by_turn_position` | Share of calls in each of the pipeline's eight groups per tenth of a turn, human-driven and benchmark |
| Prefix caching | `hit_ratio_cdf_by_gap_bin` | CDF of the hit ratio of requests in each of the pipeline's gap bins of the wait before them |
| Prefix caching | `hit_ratio_by_idle_gap` | Median hit ratio per idle-gap bin, per provider |
| Prefix caching | `gap_cdf_by_cause` | CDF of the wait before a request by what it waited for |
| Prefix caching | `mean_hit_ratio_by_cause` | Mean hit ratio by what the request waited for |
| Prefix caching | `hit_ratio_cdf_by_transition` | CDF of the hit ratio of requests after an append and after a mutation |
| Prefix caching | `mutations_by_cause` | A table: per transition and cause, the share of steps, of sessions and of prefill under infinite retention |
| Prefix caching | `prefill_against_storage` | Simulated normalised prefill against mean retained tokens, one labelled point per TTL under the TTL-only policy, human-driven and benchmark, on log axes |
| Prefix caching | `api_cost_by_ttl` | Simulated API cost per TTL at the pipeline's prices, stacked by part, as a multiple of the one-minute total, the knee marked |
| Prefix caching | `infrastructure_cost_by_ttl` | Simulated recompute and storage cost per TTL, stacked, as a multiple of the one-minute total, the minimum marked |

Each figure SHALL be one query file, answered by `make data`, and one
chart function. Each figure SHALL show a title, a one-sentence definition
and the number of rows it rests on. A figure's legend SHALL hide and show
its series. The sections SHALL have headings the header links to. Nothing
on the page SHALL run a query in the browser.

#### Scenario: Opening the page
- **WHEN** a visitor opens the Explore page
- **THEN** every figure SHALL be drawn from its answer file, and no DuckDB module and no Parquet file SHALL be fetched

#### Scenario: A simulation figure for a week without a simulation
- **WHEN** a week has no simulation rows
- **THEN** the simulated figures SHALL draw the other weeks and say which week is missing

#### Scenario: The paper's point
- **WHEN** the figures are drawn
- **THEN** the normalised prefill at each TTL the paper quotes SHALL equal the paper's, and so SHALL the mean retained tokens at the TTLs it compares

### Requirement: Sessions table
The Explore page SHALL list the top-level sessions of the answer as its
last section, 50 rows a page, with the columns:
- session (a shortened id, linked);
- week;
- started (UTC);
- harness (the benchmark's marked as a benchmark replay);
- main model;
- requests;
- turns;
- subagents;
- tool calls;
- duration;
- input tokens;
- cached share;
- peak prompt tokens.

The visitor SHALL be able to:
- sort by any column (input tokens descending by default; a second click
  reverses);
- search by a substring of the session id;
- filter by month (every month by default; a month is the weeks whose
  Sunday falls in it), by harness (every harness but the benchmark's by
  default, with "every harness" and "the paper's harnesses" at once), by
  main model and by a minimum number of requests.

The filters SHALL sit in a folded disclosure above the table that reads as
one line, the filter in words, when closed, and SHALL be applied to the
answer's rows in the browser; they SHALL change nothing but the table.
The table SHALL show how many sessions match out of how many. The search,
filters, sort and page SHALL be kept in the URL. Clicking a row SHALL open
the Session page. The table SHALL have an anchor the header links to.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses one harness and a minimum of 100 requests
- **THEN** only that harness's sessions with at least 100 requests SHALL be listed, with the count shown as matching over total

#### Scenario: Filtering to a month and a harness
- **WHEN** the visitor ticks only July 2026 and only `codex`
- **THEN** the table SHALL list July 2026's `codex` sessions, the URL SHALL read `?months=2026-07&harnesses=codex`, and every figure SHALL be unchanged

#### Scenario: The benchmark
- **WHEN** the visitor ticks the benchmark's harness
- **THEN** its sessions SHALL join the table, marked as benchmark replays

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back to Explore
- **THEN** the page SHALL open at the sessions table with the same filters, sort and page
