## ADDED Requirements

### Requirement: Three Explore pages
The Explore side of the site SHALL be three pages sharing one look, one
header and one footer: Overview, `index.html`, the landing page, with the
hero and stats strip, the mixes and trends, Cite and Team; Session
Explorer, `explorer.html`, with the sessions table and its filter;
Insights, `insights.html`, with the six topics under a topic bar. Each
page SHALL fetch only the answers its own sections draw. The Overview
page SHALL send a link to its old anchors on: `#sessions` to
`explorer.html` with the query kept, `#insights` to `insights.html`, and
`#insights-<topic>` to that topic on the Insights page.

#### Scenario: Opening the Session Explorer
- **WHEN** a visitor opens `explorer.html`
- **THEN** the page SHALL show the header, the Session Explorer heading and the table, and SHALL fetch no figure answer

#### Scenario: An old link
- **WHEN** a visitor opens `index.html?months=2026-07#sessions`
- **THEN** the browser SHALL land on `explorer.html?months=2026-07` with the table filtered to July 2026

#### Scenario: An old link to a topic
- **WHEN** a visitor opens `index.html#insights-tokens`
- **THEN** the browser SHALL land on `insights.html#tokens`

## MODIFIED Requirements

### Requirement: Sessions table
The Session Explorer page (`explorer.html`, that heading, no eyebrow)
SHALL list every top-level session of
every harness, the benchmark replay marked in its harness cell, sorted by
start date descending by default, 20 rows a page, with the columns Session
(a shortened id, linked), Started (UTC), Harness, Requests, Model, Turns,
Duration, Input tokens, Cached share. Above it, one row of plain form
controls and a line saying that a month holds the weeks whose Sunday falls
in it: a month drop-down ("All months" and one entry per month), a harness
drop-down ("All harnesses" and one entry per harness, the benchmark replay
named "swe-bench (benchmark)"), a model drop-down, a minimum number of
requests and a search box. There SHALL be no pills and no buttons. The
visitor SHALL be able to sort by any column. The table SHALL NOT scroll
inside its card: the page scrolls, and where the table fits its card its
header row SHALL stay in view under the site header. It SHALL keep the
filters, sort and page in the page's URL. Clicking a row SHALL open the
Session page.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses a minimum of 100 requests
- **THEN** only sessions with at least 100 requests SHALL be listed, with the count shown as matching over total ("120 of 12,002 sessions"); with no filter the count SHALL read the total alone ("12,002 sessions")

#### Scenario: Filtering to a month and a harness
- **WHEN** the visitor picks July 2026 in the month drop-down and `codex` in the harness drop-down
- **THEN** the table SHALL list July 2026's `codex` sessions, the URL SHALL read `explorer.html?months=2026-07&harnesses=codex`, and every figure SHALL be unchanged

#### Scenario: The benchmark
- **WHEN** the table draws
- **THEN** the benchmark replay's sessions SHALL be listed with the others, named "swe-bench" with a BENCHMARK chip whose tooltip explains the replay

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back
- **THEN** the Session Explorer page SHALL open with the same filters, sort and page

#### Scenario: Where the list sits
- **WHEN** the visitor follows the header's Session Explorer link from any page
- **THEN** the Session Explorer page SHALL open, its table the first thing under the heading

### Requirement: The page appears before the data
Each Explore page SHALL draw its layout and pickers from `weeks.json` and
`harnesses.json` first. With the default selection it SHALL then draw every
number, card, figure and the table it holds from the precomputed answers, without
waiting for DuckDB. With any other selection it SHALL show a loading state
in place of each part until its query returns. A failed query SHALL show its
error in its own place without stopping the others.

#### Scenario: The default view
- **WHEN** a visitor opens a page with no selection in the URL
- **THEN** every number, card, figure and the table it holds SHALL be drawn from `data/all_weeks/` before any DuckDB module or Parquet file is fetched

#### Scenario: A slow connection
- **WHEN** the selection is one week and DuckDB-WASM takes several seconds to download
- **THEN** the page SHALL already show the pickers and a loading state for each part

### Requirement: Insights
The Insights page (`insights.html`, that heading, no eyebrow) SHALL draw
the figures and the two kept histograms from the shipped answers, in six
numbered topics, each with a heading, a takeaway sentence of at most
twenty words under it, and no other intro text; each card with a title,
an insight of at most twelve words under the title (one sentence saying
what the chart means, a number in it only where the number is the
point), a caption of at most twelve words under the chart, and its
definition (at most forty words) and row count behind a control. Under
the site header a topic bar SHALL stay in view: one row of the six
numbered topic titles linking to their anchors, the topic in view marked,
the row scrolling sideways on a phone.

| Topic | Figures, in order |
|---|---|
| 01 Session structure (`#structure`) | `requests_per_session_cdf`, `duration_cdf`, `subagents_per_session` (histogram), `user_prompt_tokens_by_scope` |
| 02 Tokens and cost (`#tokens`) | `tokens_per_request_cdf`, `token_split_by_week`, `token_growth_by_messages`, `context_share_by_role`, `cached_fraction_per_request` (histogram), `cost_share_by_session` |
| 03 Latency (`#latency`) | `ttft_cdf_by_model`, `decode_cdf_by_model`, `session_time_by_part` (the paper's four parts: prefill, decode, tool, user idle, sessions ranked by user-idle share), `speedup_if_twice_as_fast` |
| 04 Tools (`#tools`) | `latency_by_category`, `result_tokens_by_category`, `calls_per_request_by_category`, `latency_by_batch_width`, `tool_mix_by_turn_position` |
| 05 Prefix caching (`#caching`) | `hit_ratio_cdf_by_gap_bin`, `hit_ratio_by_idle_gap`, `gap_cdf_by_cause`, `mean_hit_ratio_by_cause`, `hit_ratio_cdf_by_transition`, `mutations_by_cause`, `prefill_against_storage`, `api_cost_by_ttl`, `infrastructure_cost_by_ttl` |
| 06 Human-driven against benchmark (`#comparison`) | `turn_duration_by_scope`, `session_duration_by_scope`, `input_per_request_by_scope` |

Each figure SHALL stay one query
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

#### Scenario: A caption that grew
- **WHEN** a caption or an insight exceeds twelve words, a takeaway twenty, or a card has no insight
- **THEN** the node test that counts them SHALL fail

#### Scenario: The topic bar
- **WHEN** the visitor scrolls to the Prefix caching topic
- **THEN** the topic bar SHALL still be in view under the header with "05 Prefix caching" marked, and clicking "02 Tokens and cost" SHALL scroll to that topic's heading below the bar

### Requirement: Hero and stats strip
The Overview page SHALL open with a hero: the title "FreeInference Agentic
Dataset" with "Agentic Dataset" in the accent colour and no eyebrow above
it, a lede whose first clause counts the weeks, and five buttons:
"Session Explorer" to the Session Explorer page, "Insights" to the
Insights page, "Dataset" (the Hugging Face dataset),
the paper and the code. Beside it a stats strip SHALL show, computed from
the `trace_totals` answer and never typed, the whole trace as the paper's
summary table counts it: the weeks, sessions, requests, input tokens, tool
calls and harnesses written "13 (+1)", and a line naming the span of
dates. The strip SHALL NOT mention the benchmark.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the hero and the stats strip SHALL be visible before any figure, and the strip's sessions SHALL equal the Session Explorer's count

#### Scenario: A stat is counted, not typed
- **WHEN** the data gains a week and `make data` reruns
- **THEN** the stats strip SHALL show the new counts without an edit to the page

#### Scenario: The site buttons
- **WHEN** the visitor presses "Session Explorer" or "Insights"
- **THEN** that page SHALL open at its top

### Requirement: Cite, Team and footer
The Overview page SHALL end with a Cite section holding the paper's BibTeX in a
block with a copy button; a Team section naming Harvard MadSys and
collaborators, the paper's authors with their affiliations, and an About
paragraph saying what the site is, whose links the header, the hero and
the footer carry; and every page SHALL end with a footer with the brand
line "FreeInference Agentic
Dataset", its blurb, and the on-site and elsewhere links, and nothing
else: no copyright line and no policy links.

#### Scenario: Copying the citation
- **WHEN** the visitor presses the copy button
- **THEN** the BibTeX SHALL be on the clipboard unchanged

#### Scenario: The footer
- **WHEN** the visitor reaches the end of the page
- **THEN** the footer SHALL show the brand, its blurb and the two groups of links, and no copyright or policy text

#### Scenario: Cite from another page
- **WHEN** the visitor follows the header's Cite link on the Insights page
- **THEN** the Overview page SHALL open at the Cite section
