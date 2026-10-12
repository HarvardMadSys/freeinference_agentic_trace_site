# Spec Delta

## Purpose

The Explore page is a landing page: it says what the dataset is, shows
its figures by topic, lists its sessions, and credits and cites the work.

## ADDED Requirements

### Requirement: Hero and stats strip
The page SHALL open with a hero: an eyebrow naming the dataset, a title of
two phrases with one in the accent colour, one lede sentence, and four
buttons: to the first figure section, to the Hugging Face dataset, to the
paper and to the code. Beside it a stats strip SHALL show, computed from
the shipped answers and never typed: the weeks, sessions, requests, input
tokens, tool calls and harnesses, and a line naming the span of dates and
the cache simulation's coverage.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the hero and the stats strip SHALL be visible before any figure, and the stats SHALL equal the dataset's counts

#### Scenario: A stat is counted, not typed
- **WHEN** the data gains a week and `make data` reruns
- **THEN** the stats strip SHALL show the new counts without an edit to the page

### Requirement: Overview donuts
Below the hero, two cards SHALL show the model mix (the share of requests
per model, the eight most frequent named, the rest as Other) and the
harness mix (the share of sessions per harness) as donuts with legends
that toggle, in the site's colour orders, followed by the three weekly
trend cards.

#### Scenario: The model mix
- **WHEN** the page draws
- **THEN** the model-mix donut's shares SHALL equal the `explore/model_mix` answer and its colours SHALL match the models' colours elsewhere

### Requirement: Cite, Team and footer
The page SHALL end with a Cite section holding the paper's BibTeX in a
block with a copy button; a Team section naming Harvard MadSys and
collaborators, the paper's authors with their affiliations, and an About
paragraph with links to the dataset, the code, Open Data and
FreeInference; and a footer with the brand line, the on-site and
elsewhere links, the Harvard copyright and policy links, as Open Data's.

#### Scenario: Copying the citation
- **WHEN** the visitor presses the copy button
- **THEN** the BibTeX SHALL be on the clipboard unchanged

## MODIFIED Requirements

### Requirement: Weekly trends
Three cards in the Overview SHALL show per week the sessions by harness,
the requests by model and the input tokens cached and uncached, as stacked
bars, the four largest series named and the rest folded into Other, with
legends that toggle. With the figures frozen, a bar SHALL NOT narrow the
page.

#### Scenario: Clicking a bar
- **WHEN** the visitor clicks a week's bar while the figures are frozen
- **THEN** nothing SHALL change

#### Scenario: Models per week
- **WHEN** the requests-per-week card draws
- **THEN** each week's bar SHALL be split by model, the four largest named and the rest Other

### Requirement: Headline numbers
The headline numbers SHALL be the stats strip of the hero and nothing
else; no separate tile strip and no population line SHALL be drawn.

#### Scenario: Every week, scope All
- **WHEN** the page draws
- **THEN** the stats strip SHALL show the counts over every week and the paper's harnesses

### Requirement: Paper figures
After the Overview, the page SHALL draw the paper's figures and the two
kept histograms from the shipped answers, in six sections with a heading
and no intro text, each card with a title and a caption of at most twelve
words, and its definition (at most forty words) and row count behind a
control:

| Section | Figures, in order |
|---|---|
| Sessions | `requests_per_session_cdf`, `duration_cdf`, `subagents_per_session` (histogram), `user_prompt_tokens_by_scope` |
| Tokens and cost | `tokens_per_request_cdf`, `token_split_by_week`, `token_growth_by_messages`, `context_share_by_role`, `cached_fraction_per_request` (histogram), `cost_share_by_session` |
| Latency | `ttft_cdf_by_model`, `decode_cdf_by_model`, `session_time_by_part`, `speedup_if_twice_as_fast` |
| Tools | `latency_by_category`, `result_tokens_by_category`, `calls_per_request_by_category`, `latency_by_batch_width`, `tool_mix_by_turn_position` |
| Prefix caching | `hit_ratio_cdf_by_gap_bin`, `hit_ratio_by_idle_gap`, `gap_cdf_by_cause`, `mean_hit_ratio_by_cause`, `hit_ratio_cdf_by_transition`, `mutations_by_cause`, `prefill_against_storage`, `api_cost_by_ttl`, `infrastructure_cost_by_ttl` |
| Human-driven against benchmark | `turn_duration_by_scope`, `session_duration_by_scope`, `input_per_request_by_scope` |

Each figure SHALL stay one query file answered by `make data` and one
chart function, with the definitions, parity and legend behaviour of the
archived change `calmer-explore`. Nothing on the page SHALL run a query in
the browser.

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
- **THEN** the simulated figures SHALL draw the other weeks and the stats strip SHALL say which week the simulation misses

#### Scenario: The paper's point
- **WHEN** the figures are drawn
- **THEN** every number a figure shares with the paper SHALL equal the paper's

#### Scenario: A caption that grew
- **WHEN** a caption exceeds twelve words or a definition forty
- **THEN** the node test that counts them SHALL fail

### Requirement: Sessions table
After the figures, a Session list SHALL list every top-level session of
every harness, the benchmark replay marked in its harness cell, sorted by
start date descending by default, 50 rows a page, with the columns
Session (a shortened id, linked), Started (UTC), Harness, Model, Requests,
Turns, Duration, Input tokens, Cached share. Above it, one row of plain form controls and nothing else: a month
drop-down ("All months" and one entry per month), a harness drop-down
("All harnesses" and one entry per harness, the benchmark replay
named as such), a model drop-down, a search box and a minimum number of
requests. There SHALL be no pills and no buttons. The visitor SHALL be able to sort by any
column. The table SHALL keep its header row visible while it scrolls
inside its wrap, SHALL fit its card at desktop width, and SHALL keep the
filters, sort and page in the URL. Clicking a row SHALL open the Session
page.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses a minimum of 100 requests
- **THEN** only sessions with at least 100 requests SHALL be listed, with the count shown as matching over total

#### Scenario: Filtering to a month and a harness
- **WHEN** the visitor picks July 2026 in the month drop-down and `codex` in the harness drop-down
- **THEN** the table SHALL list July 2026's `codex` sessions, the URL SHALL read `?months=2026-07&harnesses=codex`, and every figure SHALL be unchanged

#### Scenario: The benchmark
- **WHEN** the table draws
- **THEN** the benchmark replay's sessions SHALL be listed with the others and marked as benchmark replays

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back
- **THEN** the page SHALL open at the session list with the same filters, sort and page

### Requirement: Readable in both colour schemes and on a phone
Charts SHALL use one colour per series, consistent across figures, SHALL
be legible on the light paper background, and SHALL fit a 360-pixel-wide
screen without horizontal scrolling of the page. The site SHALL declare
`color-scheme: light` and SHALL NOT switch to a dark scheme.

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** figures SHALL stack in one column and the page SHALL not scroll sideways

## REMOVED Requirements

### Requirement: Distribution cards
**Reason**: six of the eight histograms repeat CDFs drawn in the figure
sections; the two that do not become cards of their sections.
**Migration**: none.
