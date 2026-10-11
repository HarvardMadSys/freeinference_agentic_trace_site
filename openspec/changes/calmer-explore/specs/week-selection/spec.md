# Spec Delta

## Purpose

The figures are the paper's over the paper's data; the only thing a
visitor narrows is the sessions table.

## REMOVED Requirements

### Requirement: Choosing weeks
**Reason**: every figure is drawn over every week; recomputing the paper's
figures for a few weeks served no reader and cost every visitor a stream of
row files.
**Migration**: a `weeks=` or `month=` link filters the sessions table to
those months and changes no figure.

### Requirement: Choosing harnesses
**Reason**: the figures show the paper's population; a harness choice only
narrows the sessions table now.
**Migration**: a `harnesses=` link filters the sessions table.

### Requirement: The rows stream in after the default view
**Reason**: nothing in the Explore page runs a query in the browser any
more; the Session page reads its one week.
**Migration**: none; `STREAM_ROWS_AFTER_DRAW` and the stream are deleted.

## MODIFIED Requirements

### Requirement: The selection lives in the URL
The sessions table's filter SHALL be written to the URL's query string as
`months=<YYYY-MM>,<YYYY-MM>…` and `harnesses=<name>,<name>…`, and SHALL
be read from it when the page opens; it SHALL change nothing but the
table. The default (every month, the paper's harnesses) SHALL write no
key. The Session page SHALL carry the keys back to Explore. A month or
harness in the URL that the data do not hold SHALL be ignored, and the
table SHALL say which. A `month=` key SHALL be read as that month, a
`weeks=` key as the months its weeks fall in, a `scope` key or `weeks=all`
as the default; each SHALL be rewritten.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?months=2026-07&harnesses=hermes,codex`
- **THEN** the sessions table SHALL list July 2026's sessions of those two harnesses, and every figure SHALL be as without the keys

#### Scenario: An unknown week
- **WHEN** the URL's `weeks=` names a week that is not in `weeks.json`
- **THEN** the table SHALL filter to the months of the other weeks it names and show a note naming the unknown one

#### Scenario: A link from the first release
- **WHEN** a visitor opens a link with `?weeks=all&scope=All`
- **THEN** the page SHALL open with the table unfiltered and the URL SHALL be rewritten without either key

#### Scenario: A link from an earlier release
- **WHEN** a visitor opens a link with `?weeks=2026-07-05,2026-07-12&scope=All`
- **THEN** the table SHALL filter to July 2026 and the URL SHALL be rewritten as `months=2026-07`

### Requirement: The selection reaches queries as tables
The data step SHALL fill `selected_weeks` with every week and
`selected_harnesses` with every harness but the benchmark's before it
answers the Explore and figure queries, and `benchmark_harness` from
`harnesses.json`; the queries SHALL read their population from those
tables and from nothing else. The Explore page SHALL answer every query
from `data/all_weeks/`. In the browser only the Session page SHALL fill a
selection table, `selected_session(week, root_session_id)`.

#### Scenario: The default selection
- **WHEN** `make data` answers a figure query
- **THEN** it SHALL have run with every week and every non-benchmark harness in the selection tables

#### Scenario: Changing the selection
- **WHEN** the visitor unticks one month in the sessions table's filter
- **THEN** the table SHALL filter its answer's rows in the browser, no selection table SHALL be filled and no query SHALL run

#### Scenario: The Session page
- **WHEN** a session is opened
- **THEN** `selected_session` SHALL hold its week and top-level session id, and no other selection table SHALL be filled
