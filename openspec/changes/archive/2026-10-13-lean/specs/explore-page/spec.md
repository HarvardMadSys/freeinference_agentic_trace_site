## MODIFIED Requirements

### Requirement: Insights
After the Session Explorer, an Insights section (that heading, no
eyebrow, anchor `#insights`) SHALL hold the figures and the two kept
histograms, drawn from the shipped answers, in six numbered topics shown
one at a time behind a row of tabs under the heading: each topic with
its heading, a takeaway sentence of at most twenty words under it, and
no other intro text; each card with a title, an insight of at most
twenty words under the title (one sentence saying what the chart means,
a number in it only where the number is the point), a caption of at most
forty words in at most three sentences under the chart, and its
definition (at most sixty words in at most three sentences)
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

Each figure SHALL be one query
file answered by `make data` and one entry whose `draw` is one call to
a chart kind in `js/charts/` with its columns, where they vary, and its labels
written out,
plus, where the paper's callout needs it, one short named function; a
kind SHALL take only parameters two or more figures use, with two
exceptions: a kind kept whole may take a one-figure parameter when the
alternative is a near-copy of the kind, and a frame or axis setting is a
plain setting; a figure that needs more SHALL keep a plain draw function
of its own. The definitions,
parity and legend behaviour stay as they are.
Nothing on the page SHALL run a query in the browser.

#### Scenario: Opening the page
- **WHEN** a visitor opens the page
- **THEN** the first topic SHALL be shown and its figures drawn from their answer files, and no database module, no row file and no query file SHALL be fetched

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
- **WHEN** an insight or a takeaway exceeds twenty words, a caption forty, a definition sixty, or a card has no insight
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

#### Scenario: Adding a figure
- **WHEN** a maintainer adds a figure of an existing kind
- **THEN** the change SHALL be one `.sql` file, one entry whose `draw` calls the kind, its lines in the tests that list queries and figures, `make data` and `make snapshots`
