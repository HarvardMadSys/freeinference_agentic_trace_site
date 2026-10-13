## MODIFIED Requirements

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
