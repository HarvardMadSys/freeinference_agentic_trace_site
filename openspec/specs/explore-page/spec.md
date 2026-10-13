# explore-page Specification

## Purpose
The site's landing page: what the trace holds for the selected weeks and
scope, how it is distributed, how it changed week to week, and the table of
sessions that leads into any one of them.

## Requirements

### Requirement: Weekly trends
Three cards in the Overview SHALL show per week the sessions by harness,
the requests by model and the input tokens cached and uncached, as stacked
bars, the series the donuts name (those holding the eight series colours)
named and the rest folded into Other, with legends that toggle. With the figures frozen, a bar SHALL NOT narrow the
page.

#### Scenario: Clicking a bar
- **WHEN** the visitor clicks a week's bar while the figures are frozen
- **THEN** nothing SHALL change

#### Scenario: Models per week
- **WHEN** the requests-per-week card draws
- **THEN** each week's bar SHALL be split by model, the models the model-mix donut names named and the rest Other

### Requirement: Headline numbers
The headline numbers SHALL be the stats strip of the hero and nothing
else; no separate tile strip and no population line SHALL be drawn.

#### Scenario: Every week, scope All
- **WHEN** the page draws
- **THEN** the stats strip SHALL show the counts over every week and the paper's harnesses

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

### Requirement: Same definitions as the paper
With the default selection, every number a figure shares with the paper's
`numbers.json` (for example the median input tokens per request, the pooled
cost shares, the median gap by cause, the mean hit ratio by cause, the
median hit ratio after an append and after a mutation) SHALL equal the
paper's value. Where the site draws a figure more simply than the paper
(fixed bins instead of bins fitted to the data, thin bins hidden instead of
merged, model time not split into prefill and decode, no queueing estimate),
the figure's definition SHALL say so.

#### Scenario: The median input tokens per request
- **WHEN** the selection is the default
- **THEN** the median of `tokens_per_request_cdf`'s input series SHALL equal `sessions.tokens_per_request.median_input` in the paper's `numbers.json`

#### Scenario: The median gap after a tool
- **WHEN** the selection is the default
- **THEN** the median of `gap_cdf_by_cause`'s tool series SHALL equal the paper's `median_gap_s_tool`

### Requirement: Thin data is not drawn
A bin, category or model with fewer rows than a named threshold SHALL NOT be
drawn, and the figure SHALL say how many were hidden. A figure with no rows
for the selection SHALL say so instead of drawing empty axes.

#### Scenario: One small week
- **WHEN** the selection is one early week with few sessions
- **THEN** sparse bins SHALL be hidden and each figure SHALL either draw what remains or say it has too few rows

### Requirement: Legends toggle series
In a figure or trend with more than one series, each legend entry SHALL be a
button that hides or shows its series, redrawing the chart from the rows it
already has without a query. A hidden series SHALL be shown struck through
in the legend. The hidden set SHALL NOT be kept in the URL and SHALL reset
when the selection changes.

#### Scenario: Hiding a harness in the trend
- **WHEN** the visitor clicks `hermes` in the sessions-per-week legend
- **THEN** the `hermes` segments SHALL disappear from every bar, the bars SHALL rescale, and no query SHALL run

#### Scenario: Hiding a model in a CDF
- **WHEN** the visitor clicks one model in the TTFT figure's legend
- **THEN** that model's line SHALL disappear and the figure's caption SHALL still give the rows the figure rests on

### Requirement: Readable in both colour schemes and on a phone
Charts SHALL use one colour per series, consistent across figures, SHALL
be legible in both colour schemes, and SHALL fit a 360-pixel-wide screen
without horizontal scrolling of the page.

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** figures SHALL stack in one column and the page SHALL not scroll sideways

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
