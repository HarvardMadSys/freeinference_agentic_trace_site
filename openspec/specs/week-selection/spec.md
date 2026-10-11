# week-selection Specification

## Purpose
How a visitor chooses which weeks and which scope the site shows, how that
choice is kept in the URL across pages, and how it reaches every query.

## Requirements

### Requirement: Choosing weeks
The Explore and Paper figures pages SHALL show a week picker listing every week of `weeks.json`, grouped by month. The
visitor SHALL be able to tick single weeks, tick a whole month at once, and
choose every week at once. At least one week SHALL stay selected; with none,
the page SHALL say so instead of drawing empty charts.

#### Scenario: Choosing a month
- **WHEN** the visitor ticks the month `2026-08`
- **THEN** every week whose Sunday falls in August 2026 SHALL be selected and every chart SHALL redraw for those weeks

#### Scenario: Nothing selected
- **WHEN** the visitor unticks the last selected week
- **THEN** the charts SHALL be replaced by a note asking for at least one week

### Requirement: Choosing a scope
The Explore and Paper figures pages SHALL offer a scope of `Agentic` (the
default), `SWE-Bench` or `All`, with the pipeline's meaning; `All` covers
both. A chart whose data exists for only one
scope SHALL say which scope it shows.

#### Scenario: A simulation chart under the SWE-Bench scope
- **WHEN** the scope is `SWE-Bench` and the cache simulation holds only `Agentic` rows
- **THEN** the simulation charts SHALL show their `Agentic` data and say so in their caption

### Requirement: The selection lives in the URL
The selection SHALL be written to the URL's query string as
`weeks=<sunday>,<sunday>…` or `month=<YYYY-MM>` or `weeks=all`, and
`scope=<scope>`, and SHALL be read from it when a page opens. Links between
pages SHALL carry it, and the Session page SHALL carry it back to Explore. With no selection in the URL, a page SHALL select the
latest week and the `Agentic` scope. A week in the URL that is not in
`weeks.json` SHALL be ignored, and the page SHALL say which.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?month=2026-07&scope=All`
- **THEN** the page SHALL open with July 2026's weeks and the `All` scope selected

#### Scenario: An unknown week
- **WHEN** the URL names a week that is not in `weeks.json`
- **THEN** the page SHALL select the other weeks it names and show a note naming the unknown one

### Requirement: The selection reaches queries as tables
Before running its queries, a page SHALL fill the DuckDB tables
`selected_weeks(week)` and `selected_scopes(scope)` (`All` fills both
scopes), and on the Session page `selected_session(week, root_session_id)`. Every
query that depends on the selection SHALL read it from those tables and from
nothing else.

#### Scenario: Changing the selection
- **WHEN** the visitor changes the selected weeks
- **THEN** the page SHALL refill `selected_weeks` and rerun only the queries, without reloading the page or the data files' metadata
