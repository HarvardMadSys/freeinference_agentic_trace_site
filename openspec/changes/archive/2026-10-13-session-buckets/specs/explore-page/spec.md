## MODIFIED Requirements

### Requirement: Hero and stats strip
The page SHALL open with a hero: the title "FreeInference Agentic
Dataset" with "Agentic Dataset" in the accent colour and no eyebrow above
it, a lede whose first clause counts the weeks, and four buttons:
"Insights" to the Insights section, "Dataset" (the Hugging Face dataset),
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

### Requirement: Sessions table
Directly after the Overview, a Session Explorer section (that heading,
no eyebrow, anchor `#sessions`) SHALL list every top-level session of
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
filters, sort and page in the URL. Clicking a row SHALL open the Session
page.

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
