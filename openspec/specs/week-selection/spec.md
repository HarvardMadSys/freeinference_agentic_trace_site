# week-selection Specification

## Purpose
How a visitor chooses which weeks and which scope the site shows, how that
choice is kept in the URL across pages, and how it reaches every query.

## Requirements

### Requirement: The selection reaches queries as tables
The data step SHALL fill `selected_weeks` with every week and
`selected_harnesses` with every harness but the benchmark's before it
answers the figure queries, and with every harness, the benchmark's
included, before it answers the Explore queries (the Overview's mixes
and trends, the sessions table's, its first page's and the trace
totals'), and `benchmark_harness` from
`harnesses.json`; the queries SHALL read their population from those
tables and from nothing else. For the session buckets it SHALL fill
`selected_weeks` with one week at a time. The Explore page SHALL answer
every query from `data/all_weeks/`, and the Session page SHALL read its
session from a bucket; the browser SHALL fill no selection table and run
no query.

#### Scenario: The default selection
- **WHEN** `make data` answers a figure query
- **THEN** it SHALL have run with every week and every non-benchmark harness in the selection tables

#### Scenario: Changing the selection
- **WHEN** the visitor picks one month in the sessions table's drop-down
- **THEN** the table SHALL filter its answer's rows in the browser, no selection table SHALL be filled and no query SHALL run

#### Scenario: The Session page
- **WHEN** a session is opened
- **THEN** no selection table SHALL be filled and no query SHALL run

#### Scenario: An Overview query
- **WHEN** `make data` answers `explore/model_mix`
- **THEN** it SHALL have run with every harness, the benchmark's included, in `selected_harnesses`

### Requirement: The filter lives in the URL
The session list's filter SHALL be written to the Explore page's
URL query string as
`months=<YYYY-MM>` and `harnesses=<name>` (one of each, as the drop-downs
choose), and SHALL be read from it when the page opens; it SHALL change
nothing but the list. A month SHALL keep the sessions whose start, in UTC, falls in that calendar month, and the month drop-down SHALL list every calendar month from the first week's Sunday to the last week's Saturday. The default (every month, every harness) SHALL
write no key. The Session page SHALL carry the keys back to the Explore
page's Session Explorer. A
month or harness in the URL that the data do not hold SHALL be ignored,
and the list SHALL say which. A key naming several months or harnesses
SHALL keep its first and be rewritten. No other key SHALL be read or
rewritten: the filter's keys are `months`, `harnesses`, `model`,
`min_requests`, `search`, `sort`, `direction` and `page`.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `index.html?months=2026-07&harnesses=hermes,codex`
- **THEN** the session list SHALL list July 2026's `hermes` sessions, the URL SHALL be rewritten as `?months=2026-07&harnesses=hermes`, and every figure SHALL be as without the keys

#### Scenario: A session at a week's end
- **WHEN** the visitor picks May 2026
- **THEN** a session started June 6 in the week of May 31 SHALL NOT be listed, and September 2026 SHALL be an option that lists the sessions started September 1 to 5

#### Scenario: An old key
- **WHEN** a visitor opens a link with `?weeks=2026-07-05&scope=All`
- **THEN** the page SHALL open with the list unfiltered and leave the keys in the URL as they are
