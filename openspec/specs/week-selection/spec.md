# week-selection Specification

## Purpose
How a visitor chooses which weeks and which scope the site shows, how that
choice is kept in the URL across pages, and how it reaches every query.

## Requirements

### Requirement: The selection lives in the URL
The session list's filter SHALL be written to the Session Explorer page's
URL query string as
`months=<YYYY-MM>` and `harnesses=<name>` (one of each, as the drop-downs
choose), and SHALL be read from it when the page opens; it SHALL change
nothing but the list. The default (every month, every harness) SHALL
write no key. The Session page SHALL carry the keys back to the Session
Explorer page. A
month or harness in the URL that the data do not hold SHALL be ignored,
and the list SHALL say which. A key naming several months or harnesses
SHALL keep its first; a `month=` key SHALL be read as that month, a
`weeks=` key as the months its weeks fall in, a `scope` key or `weeks=all`
as the default; each SHALL be rewritten.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `explorer.html?months=2026-07&harnesses=hermes,codex`
- **THEN** the session list SHALL list July 2026's `hermes` sessions, the URL SHALL be rewritten as `?months=2026-07&harnesses=hermes`, and every figure SHALL be as without the keys

#### Scenario: An unknown week
- **WHEN** the URL's `weeks=` names a week that is not in `weeks.json`
- **THEN** the list SHALL filter to the months of the other weeks it names and show a note naming the unknown one

#### Scenario: A link from the first release
- **WHEN** a visitor opens a link with `?weeks=all&scope=All`
- **THEN** the page SHALL open with the list unfiltered and the URL SHALL be rewritten without either key

#### Scenario: A link from an earlier release
- **WHEN** a visitor opens a link with `?weeks=2026-07-05,2026-07-12&scope=All`
- **THEN** the list SHALL filter to July 2026 and the URL SHALL be rewritten as `months=2026-07`

### Requirement: The selection reaches queries as tables
The data step SHALL fill `selected_weeks` with every week and
`selected_harnesses` with every harness but the benchmark's before it
answers the Explore and figure queries, and `benchmark_harness` from
`harnesses.json`; the queries SHALL read their population from those
tables and from nothing else. For the session buckets it SHALL fill
`selected_weeks` with one week at a time. The Explore page SHALL answer
every query from `data/all_weeks/`, and the Session page SHALL read its
session from a bucket; while the figures are frozen, the browser SHALL
fill no selection table.

#### Scenario: The default selection
- **WHEN** `make data` answers a figure query
- **THEN** it SHALL have run with every week and every non-benchmark harness in the selection tables

#### Scenario: Changing the selection
- **WHEN** the visitor unticks one month in the sessions table's filter
- **THEN** the table SHALL filter its answer's rows in the browser, no selection table SHALL be filled and no query SHALL run

#### Scenario: The Session page
- **WHEN** a session is opened
- **THEN** no selection table SHALL be filled and no query SHALL run
