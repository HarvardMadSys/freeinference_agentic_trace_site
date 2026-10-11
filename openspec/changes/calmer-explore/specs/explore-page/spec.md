# Spec Delta

## Purpose

The Prefix-caching section ends in the paper's one view of the cache
simulation.

## MODIFIED Requirements

### Requirement: Paper figures
Between the distribution cards and the sessions table, the Explore page
SHALL draw these figures for the top-level sessions of the selected weeks
and harnesses, in three sections, each figure with its definition beside it:

| Section | Figure | What it plots |
|---|---|---|
| Sessions | `requests_per_session_cdf` | CDF over sessions of requests, user steps and tool steps |
| Sessions | `duration_cdf` | CDF of turn durations and of session durations, in seconds |
| Sessions | `tokens_per_request_cdf` | CDF over requests of input, uncached input and output tokens |
| Sessions | `cost_share_by_session` | Each session's cost split between cached input, uncached input and output at the pipeline's prices, sessions ranked by cached share, in rank bins |
| Sessions | `token_split_by_week` | Per selected week: the share of cached input, uncached input and output in all tokens |
| Sessions | `token_growth_by_messages` | Median cached, uncached and output tokens per bin of messages in the request |
| Sessions | `context_share_by_role` | Share of input held by system, user, assistant, tool results and tool definitions, per bin of input size |
| Sessions | `ttft_cdf_by_model` | CDF of TTFT per model, for the five models with most requests in the selection that are among the eight with most requests over every week, trusted TTFTs only |
| Sessions | `decode_cdf_by_model` | CDF of latency minus TTFT per model, for the same models and requests |
| Sessions | `session_time_by_part` | Each session's time split between model time, tool waits and human waits, sessions ranked by human share, in rank bins |
| Tools | `latency_by_category` | 5th, 25th, 50th, 75th, 95th percentile of latency per category |
| Tools | `result_tokens_by_category` | The same percentiles of result tokens per category |
| Prefix caching | `hit_ratio_cdf_by_gap_bin` | CDF of the hit ratio of requests in each of the pipeline's gap bins of the wait before them |
| Prefix caching | `hit_ratio_by_idle_gap` | Median hit ratio per idle-gap bin, per provider |
| Prefix caching | `gap_cdf_by_cause` | CDF of the wait before a request by what it waited for |
| Prefix caching | `mean_hit_ratio_by_cause` | Mean hit ratio by what the request waited for |
| Prefix caching | `hit_ratio_cdf_by_transition` | CDF of the hit ratio of requests after an append and after a mutation |
| Prefix caching | `prefill_against_storage` | Simulated normalised prefill (missed tokens over those with no TTL) against mean retained tokens (reusable and dead token-seconds over the span), one labelled point per TTL under the TTL-only policy, on log axes |

Each figure SHALL be one query file and one chart function. Each figure
SHALL show a title, a one-sentence definition, the number of rows it rests
on and the weeks and harnesses it shows. The simulated figure SHALL show
the paper's population whatever harnesses are selected and say so. The
sections SHALL have headings the header links to.

#### Scenario: A figure for one month
- **WHEN** the selection is `months=2026-07`
- **THEN** every figure SHALL be computed from the selected harnesses' top-level sessions of July 2026's weeks only

#### Scenario: A simulation figure for a week without a simulation
- **WHEN** a selected week has no simulation rows
- **THEN** the simulated figure SHALL draw the other selected weeks and say which week is missing

#### Scenario: The paper's point
- **WHEN** the selection is the default
- **THEN** the normalised prefill at each TTL the paper quotes SHALL equal the paper's, and so SHALL the mean retained tokens at the TTLs it compares
