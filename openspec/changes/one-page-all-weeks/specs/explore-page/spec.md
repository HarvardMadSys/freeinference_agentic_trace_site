# Spec Delta

## Purpose

The site's one exploring page: what the trace holds for the selected weeks,
how it changed week to week, the paper's figures redrawn for those weeks,
and, last, the table of sessions that leads into any one of them.

## MODIFIED Requirements

### Requirement: Headline numbers
The Explore page SHALL show, for the top-level sessions of the selected
weeks:
- sessions;
- accounts (distinct `user_id`);
- requests;
- input and output tokens;
- tool calls;
- subagent sessions;
- the cached share of input, which is the cached tokens over the input
  tokens of the requests whose provider reports cache reads;
- the model mix, as each model's share of requests, largest first.

Each number SHALL carry its definition on hover.

#### Scenario: Every week
- **WHEN** every week is selected
- **THEN** sessions, accounts, requests and tool calls SHALL equal the totals of the release's Agentic top-level sessions

#### Scenario: Every week, scope All
- **WHEN** a visitor opens a link from the first release with `?weeks=all&scope=All`
- **THEN** the numbers SHALL be those of every week's Agentic top-level sessions, the scope key being ignored

### Requirement: Sessions table
The Explore page SHALL list the top-level sessions of the selected weeks as
its last section, 50 rows a page, with the columns:
- session (a shortened id, linked);
- week;
- started (UTC);
- harness;
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
- filter by harness, by main model and by a minimum number of requests.

The table SHALL show how many sessions match out of how many. The search,
filters, sort and page SHALL be kept in the URL. Clicking a row SHALL open
the Session page. The table SHALL have an anchor the header links to.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses one harness and a minimum of 100 requests
- **THEN** only that harness's sessions with at least 100 requests SHALL be listed, with the count shown as matching over total

#### Scenario: Coming back from a session
- **WHEN** the visitor follows the Session page's link back to Explore
- **THEN** the page SHALL open at the sessions table with the same selection, sort, filters and page

### Requirement: The page appears before the data
The Explore page SHALL draw its layout and week picker from `weeks.json`
first. With every week selected it SHALL then draw every number, figure and
the table from the precomputed answers, without loading DuckDB. With any
other selection it SHALL show a loading state in place of each number,
figure and table until its query returns. A failed query SHALL show its
error in its own place without stopping the others.

#### Scenario: The default view
- **WHEN** a visitor opens the page with no selection in the URL
- **THEN** every number, figure and the table SHALL be drawn from `data/all_weeks/` and no DuckDB or Parquet file SHALL be fetched

#### Scenario: A slow connection
- **WHEN** the selection is one week and DuckDB-WASM takes several seconds to download
- **THEN** the page SHALL already show the week picker and a loading state for each part

## ADDED Requirements

### Requirement: Paper figures
Between the headline numbers and the sessions table, the Explore page SHALL
draw these figures for the top-level sessions of the selected weeks, in
three sections, each with its definition beside it:

| Section | Figure | What it plots |
|---|---|---|
| Sessions | `requests_per_session_cdf` | CDF over sessions of requests, user steps and tool steps |
| Sessions | `duration_cdf` | CDF of turn durations and of session durations, in seconds |
| Sessions | `tokens_per_request_cdf` | CDF over requests of input, uncached input and output tokens |
| Sessions | `cost_share_by_session` | Each session's cost split between cached input, uncached input and output at the pipeline's prices, sessions ranked by cached share, in rank bins |
| Sessions | `token_growth_by_messages` | Median cached, uncached and output tokens per bin of messages in the request |
| Sessions | `context_share_by_role` | Share of input held by system, user, assistant, tool results and tool definitions, per bin of input size |
| Sessions | `ttft_cdf_by_model` | CDF of TTFT per model, for the five models with most requests, trusted TTFTs only |
| Sessions | `decode_cdf_by_model` | CDF of latency minus TTFT per model, for the same models and requests |
| Sessions | `session_time_by_part` | Each session's time split between model time, tool waits and human waits, sessions ranked by human share, in rank bins |
| Tools | `latency_by_category` | 5th, 25th, 50th, 75th, 95th percentile of latency per category |
| Tools | `result_tokens_by_category` | The same percentiles of result tokens per category |
| Prefix caching | `hit_ratio_cdf_by_gap_bin` | CDF of the hit ratio of requests in each of the pipeline's gap bins of the wait before them |
| Prefix caching | `hit_ratio_by_idle_gap` | Median hit ratio per idle-gap bin, per provider |
| Prefix caching | `gap_cdf_by_cause` | CDF of the wait before a request by what it waited for |
| Prefix caching | `mean_hit_ratio_by_cause` | Mean hit ratio by what the request waited for |
| Prefix caching | `hit_ratio_cdf_by_transition` | CDF of the hit ratio of requests after an append and after a mutation |
| Prefix caching | `simulated_hit_ratio_by_ttl` | Simulated hit tokens over all tokens per TTL, per policy |
| Prefix caching | `retained_over_active` | Simulated reusable and dead token-seconds over active token-seconds per TTL |
| Prefix caching | `dead_over_active_by_policy` | Simulated dead token-seconds over active token-seconds per TTL, per policy |

Each figure SHALL be one query file and one chart function. Each figure
SHALL show a title, a one-sentence definition, the number of rows it rests
on and the weeks it shows. The sections SHALL have headings the header
links to.

#### Scenario: A figure for one month
- **WHEN** the selection is `month=2026-07`
- **THEN** every figure SHALL be computed from the top-level sessions of July 2026's weeks only

#### Scenario: A simulation figure for a week without a simulation
- **WHEN** a selected week has no simulation rows
- **THEN** the three simulated figures SHALL draw the other selected weeks and say which week is missing

### Requirement: Same definitions as the paper
With every week selected, every number a figure shares with the paper's
`numbers.json` (for example the median input tokens per request, the pooled
cost shares, the median gap by cause, the mean hit ratio by cause, the
median hit ratio after an append and after a mutation) SHALL equal the
paper's value. Where the site draws a figure more simply than the paper
(fixed bins instead of bins fitted to the data, thin bins hidden instead of
merged, model time not split into prefill and decode, no queueing estimate),
the figure's definition SHALL say so.

#### Scenario: The median input tokens per request
- **WHEN** every week is selected
- **THEN** the median of `tokens_per_request_cdf`'s input series SHALL equal `sessions.tokens_per_request.median_input` in the paper's `numbers.json`

#### Scenario: The median gap after a tool
- **WHEN** every week is selected
- **THEN** the median of `gap_cdf_by_cause`'s tool series SHALL equal the paper's `median_gap_s_tool`

### Requirement: Thin data is not drawn
A bin, category or model with fewer rows than a named threshold SHALL NOT be
drawn, and the figure SHALL say how many were hidden. A figure with no rows
for the selection SHALL say so instead of drawing empty axes.

#### Scenario: One small week
- **WHEN** the selection is one early week with few sessions
- **THEN** sparse bins SHALL be hidden and each figure SHALL either draw what remains or say it has too few rows

### Requirement: Figures draw when in view and redraw on selection change
With every week selected, every figure SHALL be drawn from its precomputed
answer as soon as the page opens. With any other selection, a figure's query
SHALL start when its card scrolls into view, and a figure already drawn for
the current selection SHALL NOT be queried again. Changing the selection
SHALL mark every figure as not drawn and redraw the ones in view, and SHALL
NOT reload the page.

#### Scenario: A narrowed selection
- **WHEN** the visitor unticks a week and the Tools section is below the viewport
- **THEN** the figures in view SHALL redraw, and the Tools figures SHALL query when the visitor scrolls to them

### Requirement: Readable in both colour schemes and on a phone
Charts SHALL use one colour per series, consistent across figures (the same
model, category, cause or policy has the same colour everywhere), SHALL be
legible in light and dark mode, and SHALL fit a 360-pixel-wide screen without
horizontal scrolling of the page.

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** figures SHALL stack in one column and the page SHALL not scroll sideways

## REMOVED Requirements

### Requirement: Distribution cards
**Reason**: Every quantity a card showed is a paper figure (tokens per
request, requests per session, session duration, hit ratio) or a headline
number and a table column (turns, subagents per session).
**Migration**: The cards, their sixteen queries and the histogram module go.
