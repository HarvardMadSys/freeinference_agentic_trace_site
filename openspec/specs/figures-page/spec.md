# figures-page Specification

## Purpose
The paper's figures, redrawn in the browser for any selection of weeks and
scope, each with its definition beside it.

## Requirements

### Requirement: The figures
The Paper figures page SHALL draw these figures for the top-level sessions of the
selected weeks and scope, in three sections:

| Section | Figure | What it plots |
|---|---|---|
| Sessions | `requests_per_session_cdf` | CDF over sessions of requests, user steps and tool steps |
| Sessions | `duration_cdf` | CDF of turn durations and of session durations, in seconds |
| Sessions | `tokens_per_request_cdf` | CDF over requests of input, uncached input and output tokens |
| Sessions | `token_split_by_week` | Per selected week: the share of cached input, uncached input and output in all tokens |
| Sessions | `token_growth_by_messages` | Median cached, uncached and output tokens per bin of messages in the request |
| Sessions | `context_share_by_role` | Share of input held by system, user, assistant, tool results and tool definitions, per bin of input size |
| Sessions | `ttft_cdf_by_model` | CDF of TTFT per model, for the five models with most requests, trusted TTFTs only |
| Tools | `tool_overview` | Table per category: calls, share of calls, sessions using it, failed share, median latency, median result tokens |
| Tools | `calls_per_request` | Share of tool-step requests by number of tool calls they emitted |
| Tools | `latency_by_category` | 5th, 25th, 50th, 75th, 95th percentile of latency per category |
| Tools | `result_tokens_by_category` | The same percentiles of result tokens per category |
| Prefix caching | `hit_ratio_by_idle_gap` | Median hit ratio per idle-gap bin, per provider |
| Prefix caching | `hit_ratio_by_transition` | Mean hit ratio of requests after an append, a mutation and a switch |
| Prefix caching | `simulated_hit_ratio_by_ttl` | Simulated hit tokens over all tokens per TTL, per policy |
| Prefix caching | `dead_over_active_by_policy` | Simulated dead token-seconds over active token-seconds per TTL, per policy |

Each figure SHALL be one query file and one chart function. Each figure SHALL
show a title, a one-sentence definition, the number of rows it rests on, and
the scope and weeks it shows.

#### Scenario: A figure for one month
- **WHEN** the selection is `month=2026-07` and scope `Agentic`
- **THEN** every figure SHALL be computed from the Agentic top-level sessions of July 2026's weeks only

### Requirement: Same definitions as the paper
With every week selected, every number a figure shares with the paper's
`numbers.json` (for example the median input tokens per request) SHALL equal
the paper's value, in the scope the paper counts that number in: `Agentic`
for the figures, `All` for the dataset totals, `SWE-Bench` for the benchmark
medians. Where the site draws a figure
more simply than the paper (fixed bins instead of bins fitted to the data,
thin bins hidden instead of merged), the figure's definition SHALL say so.

#### Scenario: The median input tokens per request
- **WHEN** every week and the `Agentic` scope are selected
- **THEN** the median of `tokens_per_request_cdf`'s input series SHALL equal `sessions.tokens_per_request.median_input` in the paper's `numbers.json`

### Requirement: Thin data is not drawn
A bin, category or model with fewer rows than a named threshold SHALL NOT be
drawn, and the figure SHALL say how many were hidden. A figure with no rows
for the selection SHALL say so instead of drawing empty axes.

#### Scenario: One small week
- **WHEN** the selection is one early week with few SWE-Bench sessions and the scope is `SWE-Bench`
- **THEN** sparse bins SHALL be hidden and each figure SHALL either draw what remains or say it has too few rows

### Requirement: Figures redraw on selection change
Changing the selection SHALL rerun every figure's query and redraw it, and
SHALL NOT reload the page. Figures below the visible part of the page MAY be
queried when scrolled into view.

#### Scenario: Changing scope
- **WHEN** the visitor switches the scope from `Agentic` to `All`
- **THEN** every figure that depends on scope SHALL redraw and the URL SHALL say `scope=All`

### Requirement: Readable in both colour schemes and on a phone
Charts SHALL use one colour per series, consistent across figures (the same
model, category or policy has the same colour everywhere), SHALL be legible
in light and dark mode, and SHALL fit a 360-pixel-wide screen without
horizontal scrolling of the page.

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** figures SHALL stack in one column and the page SHALL not scroll sideways
