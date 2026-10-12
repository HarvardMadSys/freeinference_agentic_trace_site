## RENAMED Requirements
- FROM: `### Requirement: Paper figures`
- TO: `### Requirement: Findings`

## MODIFIED Requirements

### Requirement: Sessions table
Directly after the Overview, a Sessions section (eyebrow "Sessions",
heading "Browse every session", anchor `#sessions`) SHALL list every
top-level session of every harness, the benchmark replay marked in its
harness cell, sorted by start date descending by default, 20 rows a page,
with the columns Session (a shortened id, linked), Started (UTC), Harness,
Requests, Model, Turns, Duration, Input tokens, Cached share. Above it, one
row of plain form controls and a line saying that a month holds the weeks
whose Sunday falls in it: a month drop-down ("All months" and one entry per
month), a harness drop-down ("All harnesses" and one entry per harness, the
benchmark replay named "swe-bench (benchmark)"), a model drop-down, a
minimum number of requests and a search box. There SHALL be no pills and
no buttons. The visitor SHALL be able to sort by any column. The table
SHALL NOT scroll inside its card: the page scrolls, and where the table
fits its card its header row SHALL stay in view under the site header. It
SHALL keep the filters, sort and page in the URL. Clicking a row SHALL open
the Session page.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses a minimum of 100 requests
- **THEN** only sessions with at least 100 requests SHALL be listed, with the count shown as matching over total ("120 of 12,002 sessions"); with no filter the count SHALL name the benchmark replay's share ("12,002 sessions, 1,035 of them benchmark replay")

#### Scenario: Filtering to a month and a harness
- **WHEN** the visitor picks July 2026 in the month drop-down and `codex` in the harness drop-down
- **THEN** the table SHALL list July 2026's `codex` sessions, the URL SHALL read `?months=2026-07&harnesses=codex`, and every figure SHALL be unchanged

#### Scenario: The benchmark
- **WHEN** the table draws
- **THEN** the benchmark replay's sessions SHALL be listed with the others, named "swe-bench" with a BENCHMARK chip whose tooltip explains the replay

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back
- **THEN** the page SHALL open at the Sessions section with the same filters, sort and page

#### Scenario: Where the list sits
- **WHEN** the visitor scrolls past the Overview
- **THEN** the next section SHALL be the Sessions section, and the Findings SHALL follow it

### Requirement: Findings
After the Sessions section, a Findings section (eyebrow "Findings",
heading "What the trace shows", anchor `#findings`) SHALL draw the figures
and the two kept histograms from the shipped answers, in six numbered
topics, each with a heading, a takeaway sentence of at most twenty-five
words under it, and no other intro text; each card with a title, a finding
line of at most sixteen words under the title (a number-led phrase in the
strong weight, then a plain clause), a caption of at most twelve words
under the chart, and its definition (at most forty words) and row count
behind a control:

| Topic | Figures, in order |
|---|---|
| 01 Session structure (`#findings-sessions`) | `requests_per_session_cdf`, `duration_cdf`, `subagents_per_session` (histogram), `user_prompt_tokens_by_scope` |
| 02 Tokens and cost (`#findings-tokens`) | `tokens_per_request_cdf`, `token_split_by_week`, `token_growth_by_messages`, `context_share_by_role`, `cached_fraction_per_request` (histogram), `cost_share_by_session` |
| 03 Latency (`#findings-latency`) | `ttft_cdf_by_model`, `decode_cdf_by_model`, `session_time_by_part` (the paper's four parts: prefill, decode, tool, user idle, sessions ranked by user-idle share), `speedup_if_twice_as_fast` |
| 04 Tools (`#findings-tools`) | `latency_by_category`, `result_tokens_by_category`, `calls_per_request_by_category`, `latency_by_batch_width`, `tool_mix_by_turn_position` |
| 05 Prefix caching (`#findings-caching`) | `hit_ratio_cdf_by_gap_bin`, `hit_ratio_by_idle_gap`, `gap_cdf_by_cause`, `mean_hit_ratio_by_cause`, `hit_ratio_cdf_by_transition`, `mutations_by_cause`, `prefill_against_storage`, `api_cost_by_ttl`, `infrastructure_cost_by_ttl` |
| 06 Human-driven against benchmark (`#findings-comparison`) | `turn_duration_by_scope`, `session_duration_by_scope`, `input_per_request_by_scope` |

Every number a finding states SHALL be read from the figure's answer by a
function the entry names and checked by a test; a finding whose number the
answer cannot yield SHALL state no number. Each figure SHALL stay one query
file answered by `make data` and one chart function, with the definitions,
parity and legend behaviour of the archived change `calmer-explore`.
Nothing on the page SHALL run a query in the browser.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** every figure SHALL be drawn from its answer file, and no DuckDB module and no Parquet file SHALL be fetched

#### Scenario: A figure for one month
- **WHEN** the URL carries `months=2026-07`
- **THEN** every figure SHALL still show every week and the paper's harnesses; only the session list SHALL be filtered

#### Scenario: The definition on demand
- **WHEN** the visitor opens a figure card's definition control
- **THEN** the card SHALL show the figure's full definition and the rows it rests on, and hide them again when closed

#### Scenario: A simulation figure for a week without a simulation
- **WHEN** a week has no simulation rows
- **THEN** the simulated figures SHALL draw the other weeks and their line of rows SHALL say which week the simulation misses

#### Scenario: The paper's point
- **WHEN** the figures are drawn
- **THEN** every number a figure shares with the paper SHALL equal the paper's

#### Scenario: A finding's number
- **WHEN** `make data` reruns and a figure's median moves
- **THEN** the findings test SHALL fail until the finding's text is changed, because the number it states no longer appears in the answer's formatted value

#### Scenario: A caption that grew
- **WHEN** a caption exceeds twelve words, a finding sixteen or a takeaway twenty-five
- **THEN** the node test that counts them SHALL fail

### Requirement: Hero and stats strip
The page SHALL open with a hero: an eyebrow naming the dataset, a title of
two phrases with one in the accent colour, one lede sentence, and four
buttons: "Explore the findings" to the Findings section, "Dataset" (the
Hugging Face dataset), the paper and the code. Beside it a stats strip
SHALL show, computed from the shipped answers and never typed: the weeks,
human-driven sessions, requests, input tokens, tool calls and harnesses,
and a line naming the span of dates and that the benchmark replay is not
counted.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the hero and the stats strip SHALL be visible before any figure, and the stats SHALL equal the dataset's counts

#### Scenario: A stat is counted, not typed
- **WHEN** the data gains a week and `make data` reruns
- **THEN** the stats strip SHALL show the new counts without an edit to the page
