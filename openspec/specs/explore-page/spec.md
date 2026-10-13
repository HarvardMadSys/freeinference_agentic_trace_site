# explore-page Specification

## Purpose
The site's landing page: what the trace holds for the selected weeks and
scope, how it is distributed, how it changed week to week, and the table of
sessions that leads into any one of them.

## Requirements

### Requirement: Weekly trends
Three cards in the Overview SHALL show per week the sessions by harness,
the requests by model and the input tokens cached and uncached, over
every harness, the benchmark's included, as stacked
bars, the series the donuts name (those holding the eight series colours)
named and the rest folded into Other, with legends that toggle, each
chart as wide as its card's body, its x axis ticked at every month the
weeks span, the first and the last included. With the figures frozen, a bar SHALL NOT narrow the
page.

#### Scenario: Clicking a bar
- **WHEN** the visitor clicks a week's bar while the figures are frozen
- **THEN** nothing SHALL change

#### Scenario: Models per week
- **WHEN** the requests-per-week card draws
- **THEN** each week's bar SHALL be split by model, the models the model-mix donut names named and the rest Other

#### Scenario: The benchmark's weeks
- **WHEN** the sessions-per-week card draws
- **THEN** the benchmark replay's sessions SHALL be in their weeks' bars as the `swe-bench` series

### Requirement: Headline numbers
The headline numbers SHALL be the stats strip of the hero and nothing
else; no separate tile strip and no population line SHALL be drawn.

#### Scenario: Every week, scope All
- **WHEN** the page draws
- **THEN** the stats strip SHALL show the counts over every week and the paper's harnesses

### Requirement: Sessions table
Directly after the Overview, a Session Explorer section (that heading,
no eyebrow, anchor `#sessions`, and under the heading the line "Click a
session to open its requests, context and timeline.") SHALL list every
top-level session of
every harness, the benchmark replay marked in its harness cell, sorted by
start date descending by default, 20 rows a page, with the columns Session
(a shortened id, linked), Started (UTC), Harness, Requests, Model, Turns,
Duration, Input tokens, Cached share. Above it, one row of plain form
controls: a month drop-down ("All months" and one entry per month), a harness
drop-down ("All harnesses" and one entry per harness, the benchmark replay
named "swe-bench (benchmark)"), a model drop-down, a minimum number of
requests and a search box; no line explaining the months. There SHALL be no pills and no buttons but
the sort buttons in the column headers. The
visitor SHALL be able to sort by any column from the keyboard as well as
the mouse, each header a button that announces its sort state. The table SHALL NOT scroll
inside its card: the page scrolls, and where the table fits its card its
header row SHALL stay in view under the site header. It SHALL keep the
filters, sort and page in the URL. Clicking a row SHALL open the
Session page. On the default view the table SHALL draw its first page
from the small answer `explore/sessions_first_page` (the 20 newest
sessions and the total count) before the full list is fetched, and
enable its controls once the full list has arrived.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses a minimum of 100 requests
- **THEN** only sessions with at least 100 requests SHALL be listed, with the count shown as matching over total ("120 of 12,002 sessions"); with no filter the count SHALL read the total alone ("12,002 sessions")

#### Scenario: Filtering to a month and a harness
- **WHEN** the visitor picks July 2026 in the month drop-down and `codex` in the harness drop-down
- **THEN** the table SHALL list July 2026's `codex` sessions, the URL SHALL read `?months=2026-07&harnesses=codex`, and every figure SHALL be unchanged

#### Scenario: The benchmark
- **WHEN** the table draws
- **THEN** the benchmark replay's sessions SHALL be listed with the others, named "swe-bench" with a BENCHMARK chip whose tooltip explains the replay

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back
- **THEN** the page SHALL open at the Session Explorer with the same filters, sort and page

#### Scenario: Where the list sits
- **WHEN** the visitor scrolls past the Overview
- **THEN** the next section SHALL be the Session Explorer, and the Insights SHALL follow it

#### Scenario: The guide line
- **WHEN** the Session Explorer draws
- **THEN** the line under its heading SHALL say that clicking a session opens it, and no line SHALL explain what a month holds

#### Scenario: The first page before the list
- **WHEN** a visitor opens the page with no table key in the URL on a slow connection
- **THEN** the first 20 rows and the total SHALL be drawn from the first-page answer before `sessions_of_selection.json` has arrived, and the filters SHALL be enabled once it has

#### Scenario: Sorting from the keyboard
- **WHEN** the visitor tabs to the Requests header and presses Enter
- **THEN** the table SHALL sort by requests and the header SHALL announce the direction

### Requirement: The page appears before the data
The Explore page SHALL draw its layout and pickers from `weeks.json` and
`harnesses.json` first. With the default selection it SHALL then draw every
number, card, the table's first page and the shown topic's figures from the precomputed answers, without
waiting for DuckDB or for the full session list. With any other selection it SHALL show a loading state
in place of each part until its query returns. A failed query SHALL show its
error in its own place without stopping the others.

#### Scenario: The default view
- **WHEN** a visitor opens the page with no selection in the URL
- **THEN** every number, card, the table's first page and the shown topic's figures SHALL be drawn from `data/all_weeks/` before any DuckDB module or Parquet file is fetched

#### Scenario: A slow connection
- **WHEN** the selection is one week and DuckDB-WASM takes several seconds to download
- **THEN** the page SHALL already show the pickers and a loading state for each part

### Requirement: Insights
After the Session Explorer, an Insights section (that heading, no
eyebrow, anchor `#insights`) SHALL hold the figures and the two kept
histograms, drawn from the shipped answers, in six numbered topics shown
one at a time behind a row of tabs under the heading: each topic with
its heading, a takeaway sentence of at most twenty words under it, and
no other intro text; each card with a title, an insight of at most
twelve words under the title (one sentence saying what the chart means,
a number in it only where the number is the point), a caption of at most
twelve words under the chart, and its definition (at most forty words)
and row count behind a control. A click on a tab SHALL show its topic
and hide the others, and SHALL write the topic's anchor to the URL's
hash, so that a link with that hash opens the Insights on that topic and
the browser's Back returns to the topic before, whatever anchor the page
opened on. The tab row SHALL follow the ARIA tabs pattern: one tab stop,
the arrow keys, Home and End moving between topics, each topic a tab
panel labelled by its tab. A topic's figures SHALL
be drawn when its tab is first shown, at the width the card has then.
Every series a chart draws SHALL be in its legend.

| Topic | Figures, in order |
|---|---|
| 01 Session structure (`#insights-sessions`) | `requests_per_session_cdf`, `duration_cdf`, `subagents_per_session` (histogram), `user_prompt_tokens_by_scope` |
| 02 Tokens and cost (`#insights-tokens`) | `tokens_per_request_cdf`, `token_split_by_week`, `token_growth_by_messages`, `context_share_by_role`, `cached_fraction_per_request` (histogram), `cost_share_by_session` |
| 03 Latency (`#insights-latency`) | `ttft_cdf_by_model`, `decode_cdf_by_model`, `session_time_by_part` (the paper's four parts: prefill, decode, tool, user idle, sessions ranked by user-idle share), `speedup_if_twice_as_fast` |
| 04 Tools (`#insights-tools`) | `latency_by_category`, `result_tokens_by_category`, `calls_per_request_by_category`, `latency_by_batch_width`, `tool_mix_by_turn_position` |
| 05 Prefix caching (`#insights-caching`) | `hit_ratio_cdf_by_gap_bin`, `hit_ratio_by_idle_gap`, `gap_cdf_by_cause`, `mean_hit_ratio_by_cause`, `hit_ratio_cdf_by_transition`, `mutations_by_cause`, `prefill_against_storage`, `api_cost_by_ttl`, `infrastructure_cost_by_ttl` |
| 06 Human-driven against benchmark (`#insights-comparison`) | `turn_duration_by_scope`, `session_duration_by_scope`, `input_per_request_by_scope` |

Each figure SHALL stay one query
file answered by `make data` and one chart function, with the definitions,
parity and legend behaviour of the archived change `calmer-explore`.
Nothing on the page SHALL run a query in the browser.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the first topic SHALL be shown and its figures drawn from their answer files, and no DuckDB module and no Parquet file SHALL be fetched

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
- **WHEN** the visitor clicks "05 Prefix caching"
- **THEN** that topic alone SHALL be shown, its nine figures drawn at their cards' width, and the URL's hash SHALL read `#insights-caching`

#### Scenario: A link to a topic
- **WHEN** a visitor opens `index.html#insights-tokens`
- **THEN** the page SHALL scroll to the Insights with "02 Tokens and cost" shown

#### Scenario: Back
- **WHEN** the visitor has switched from the first topic to the fourth and presses the browser's Back
- **THEN** the first topic SHALL be shown again

#### Scenario: Back from the Session page's link
- **WHEN** the page was opened at `#sessions`, the visitor clicks "03 Latency" and presses Back
- **THEN** the first topic SHALL be shown again

#### Scenario: The arrow keys
- **WHEN** the shown tab has focus and the visitor presses ArrowRight
- **THEN** the next topic SHALL be shown and its tab focused, and Tab SHALL leave the row

#### Scenario: A series in the legend
- **WHEN** the API cost figure draws
- **THEN** its legend SHALL list every part the stack draws, the output part included

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
in the legend. The legend SHALL be one tab stop, the arrow keys moving
between its buttons. The hidden set SHALL NOT be kept in the URL and SHALL reset
when the selection changes.

#### Scenario: Hiding a harness in the trend
- **WHEN** the visitor clicks `hermes` in the sessions-per-week legend
- **THEN** the `hermes` segments SHALL disappear from every bar, the bars SHALL rescale, and no query SHALL run

#### Scenario: Hiding a model in a CDF
- **WHEN** the visitor clicks one model in the TTFT figure's legend
- **THEN** that model's line SHALL disappear and the figure's caption SHALL still give the rows the figure rests on

#### Scenario: Tabbing past a legend
- **WHEN** the visitor presses Tab on a legend's focused button
- **THEN** focus SHALL leave the legend, and ArrowRight SHALL have moved it to the next button instead

### Requirement: Readable in both colour schemes and on a phone
Charts SHALL use one colour per series, consistent across figures: a
tool category SHALL have the same colour in every chart and only Other
SHALL be grey; no role of a request's input SHALL share a hue with a
part of its tokens or a part of a session's time. Every chart SHALL carry
an accessible name made of its title and its insight (or caption). Charts SHALL
be legible in both colour schemes, and SHALL fit a 360-pixel-wide screen
without horizontal scrolling of the page. Every bar chart SHALL start its
bars at zero, and no line label SHALL cross its line.

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** figures SHALL stack in one column and the page SHALL not scroll sideways

#### Scenario: Grey means Other
- **WHEN** the tool latency figure draws
- **THEN** MCP, Subagent, Ask User, `*Packages`, `*Wait/Poll` and `*File Ops` SHALL each have a colour of their own and Other alone SHALL be grey

#### Scenario: A screen reader
- **WHEN** a screen reader reaches a figure's chart
- **THEN** it SHALL read the figure's title and insight

### Requirement: Hero and stats strip
The page SHALL open with a hero: the title "FreeInference Agentic
Dataset" with "Agentic Dataset" in the accent colour and no eyebrow above
it, the lede "16 weeks worth of production agent traces from FreeInference
across diverse agent harnesses, with latency, tool, and KV block
information." whose week count is read from `weeks.json` and written in
digits, five buttons:
"Session Explorer" to the Session Explorer section, "Insights" to the
Insights section, "Dataset" (the Hugging Face dataset),
the paper and the code, and under them the lab's name "Harvard SEAS ·
MadSys Lab" linking to the lab. Beside it a stats strip SHALL show, computed from
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
- **THEN** the page SHALL scroll to that section

#### Scenario: The lede counts the weeks
- **WHEN** the data gains a week
- **THEN** the lede SHALL open "17 weeks worth of" without an edit to the page

### Requirement: Overview donuts
Below the hero, two cards SHALL show the model mix (the share of requests
per model, the eight most frequent named, the rest as Other) and the
harness mix (the share of sessions per harness), both over every
harness, the benchmark's included, so that the donuts' centre counts
equal the stats strip's, as donuts with legends
that toggle, in the site's colour orders, the harnesses' colours starting
from a different slot than the models', followed by the three weekly
trend cards. On a phone a donut's legend SHALL be one column.

#### Scenario: The model mix
- **WHEN** the page draws
- **THEN** the model-mix donut's shares SHALL equal the `explore/model_mix` answer and its colours SHALL match the models' colours elsewhere

#### Scenario: The harness mix
- **WHEN** the page draws
- **THEN** the harness-mix donut SHALL name `swe-bench` among the harnesses, its centre SHALL read the stats strip's session count, and its first slice SHALL NOT share the model mix's first colour

### Requirement: Cite, Team and footer
The page SHALL end with a Cite section holding the paper's BibTeX in a
block with a copy button, its lines wrapping rather than scrolling; a Team section naming Harvard MadSys and
collaborators and the paper's authors with their affiliations, and no
About paragraph; and a footer with the brand
line "FreeInference Agentic
Dataset", the line "<N> weeks worth of coding agent traces from
FreeInference." with N the count of `weeks.json` in digits, the lab's name "Harvard SEAS · MadSys Lab" linking to the
lab, and the on-site and elsewhere links, and nothing
else: no copyright line and no policy links. Every link that leaves the
site, on any page, SHALL show an arrow after its text.

#### Scenario: Copying the citation
- **WHEN** the visitor presses the copy button
- **THEN** the BibTeX SHALL be on the clipboard unchanged

#### Scenario: The footer
- **WHEN** the visitor reaches the end of the page
- **THEN** the footer SHALL show the brand, its line, the lab's name and the two groups of links, and no copyright or policy text

#### Scenario: Cite from another page
- **WHEN** the visitor follows the header's Cite link on the Session page
- **THEN** the Explore page SHALL open at the Cite section

#### Scenario: A link off the site
- **WHEN** the visitor looks at the hero's Paper button or the footer's Dataset link
- **THEN** each SHALL end in an arrow, and the Session Explorer link SHALL not

#### Scenario: The footer counts the weeks
- **WHEN** the data gains a week
- **THEN** the footer's line SHALL open "17 weeks" as the hero's lede does, without an edit to the page
