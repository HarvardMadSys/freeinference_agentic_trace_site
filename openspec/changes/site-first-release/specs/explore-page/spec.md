# Spec Delta

## Purpose

The site's landing page: what the trace holds for the selected weeks and
scope, how it is distributed, how it changed week to week, and the table of
sessions that leads into any one of them.

## ADDED Requirements

### Requirement: Weekly trends
The Explore page SHALL show one bar per week, for every week whatever the
selection, of sessions per week stacked by harness and input tokens per week
split into cached and uncached. The selected weeks SHALL be highlighted.
Clicking a week's bar SHALL select that week alone.

#### Scenario: Clicking a bar
- **WHEN** the visitor clicks the bar of week 2026-08-09
- **THEN** the selection SHALL become that week alone, the URL SHALL change, and every other part of the page SHALL redraw

### Requirement: Headline numbers
The Explore page SHALL show, for the top-level sessions of the selected weeks
and scope:
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

#### Scenario: Every week, scope All
- **WHEN** every week and the scope `All` are selected
- **THEN** sessions, accounts, requests and tool calls SHALL equal the release's totals for its top-level sessions

### Requirement: Distribution cards
The Explore page SHALL show one histogram card for each of: input tokens per
request, uncached input tokens per request, output tokens per request,
requests per session, turns per session, subagents per session, session
duration, and cached fraction per request. Each card SHALL:
- draw its bins on a log scale where the quantity spans more than two orders
  of magnitude (token counts, counts per session, durations), on a linear
  scale otherwise (the cached fraction), and say which on the card;
- mark the 50th, 75th, 90th and 95th percentiles as dashed lines in fixed
  colours, with a legend;
- give `n`, the median, the 90th percentile and the maximum under its title;
- show a bin's range and count on hover.

The percentiles SHALL be exact quantiles of the selected rows, not estimates
from the bins.

#### Scenario: A card for one week
- **WHEN** one week is selected
- **THEN** the input-tokens card's median SHALL equal the median of `prompt_tokens` over that week's top-level requests in scope

### Requirement: Sessions table
The Explore page SHALL list the top-level sessions of the selected weeks and
scope, 50 rows a page, with the columns:
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
the Session page.

#### Scenario: Searching for a session
- **WHEN** the visitor types the first eight characters of a session's id
- **THEN** the table SHALL list that session, and clicking it SHALL open `session.html?week=<its week>&id=<its id>`

#### Scenario: Filtering
- **WHEN** the visitor chooses one harness and a minimum of 100 requests
- **THEN** only that harness's sessions with at least 100 requests SHALL be listed, with the count shown as matching over total

### Requirement: The page appears before the data
The Explore page SHALL draw its layout and week picker from `weeks.json`
before DuckDB has loaded. It SHALL show a loading state in place of each
number, card and table until its query returns. A failed query SHALL show
its error in its own place without stopping the others.

#### Scenario: A slow connection
- **WHEN** DuckDB-WASM takes several seconds to download
- **THEN** the page SHALL already show the week picker and a loading state for each part
