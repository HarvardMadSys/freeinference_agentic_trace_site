# Spec Delta

## Purpose

How a visitor chooses which weeks and which harnesses the site shows, how
that choice is kept in the URL across pages, and how it reaches every
query: from precomputed answers for the default selection, from DuckDB over
streamed rows otherwise.

## MODIFIED Requirements

### Requirement: Choosing weeks
The Explore page SHALL show a week picker listing every week of
`weeks.json`, grouped by month, with every week selected by default. The
visitor SHALL be able to untick and tick single weeks, a whole month at once,
and every week at once. With no week selected, the page SHALL say so instead
of drawing empty charts. While the selection is not the default, the picker
SHALL say that the charts are computed in the browser and which weeks' rows
have already been streamed in.

#### Scenario: Opening the site
- **WHEN** a visitor opens the Explore page with no selection in the URL
- **THEN** every week SHALL be selected and every chart SHALL show every week

#### Scenario: Choosing a month
- **WHEN** the visitor keeps only the month `2026-08` selected
- **THEN** every chart SHALL redraw for the weeks whose Sunday falls in August 2026, and the picker SHALL say the charts are computed in the browser

#### Scenario: Nothing selected
- **WHEN** the visitor unticks the last selected week
- **THEN** the charts SHALL be replaced by a note asking for at least one week

### Requirement: The selection lives in the URL
The selection SHALL be written to the URL's query string as
`weeks=<sunday>,<sunday>…` or `month=<YYYY-MM>`, and `harnesses=<name>,<name>…`,
and SHALL be read from it when a page opens. The default (every week, the
paper's harnesses) SHALL write no key. Links between pages SHALL carry it,
and the Session page SHALL carry it back to Explore. A week or harness in
the URL that the data do not hold SHALL be ignored, and the page SHALL say
which. A `scope` key or `weeks=all` in the URL SHALL be read as the default
and dropped.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?month=2026-07&harnesses=hermes,codex`
- **THEN** the page SHALL open with July 2026's weeks and those two harnesses selected

#### Scenario: An unknown week
- **WHEN** the URL names a week that is not in `weeks.json`
- **THEN** the page SHALL select the other weeks it names and show a note naming the unknown one

#### Scenario: A link from the first release
- **WHEN** a visitor opens a link with `?weeks=all&scope=All`
- **THEN** the page SHALL open with the default selection and the URL SHALL be rewritten without either key

### Requirement: The selection reaches queries as tables
A page SHALL answer a selection query from `data/all_weeks/` when the
selection is the default, and from DuckDB otherwise. Before running a query
in DuckDB, a page SHALL fill the DuckDB tables `selected_weeks(week)` and
`selected_harnesses(harness)`, and on the Session page
`selected_session(week, root_session_id)`. Every query that depends on the
selection SHALL read it from those tables and from nothing else.

#### Scenario: The default selection
- **WHEN** the selection is the default
- **THEN** every chart SHALL be drawn from its precomputed answer and no Parquet file SHALL be read for it

#### Scenario: Changing the selection
- **WHEN** the visitor unticks one week
- **THEN** the page SHALL fill `selected_weeks` and rerun only the queries, without reloading the page

## ADDED Requirements

### Requirement: Choosing harnesses
The Explore page SHALL show a harness picker listing every harness of
`harnesses.json` with its number of sessions, the benchmark harness marked
as such. Every harness but the benchmark SHALL be selected by default, which
is the paper's population. The visitor SHALL be able to untick and tick
single harnesses, and select every harness or the default at once. Every
chart that depends on the selection SHALL show the selected harnesses' top-level
sessions only; the weekly trends SHALL show every week of the selected
harnesses.

#### Scenario: Leaving out a harness
- **WHEN** the visitor unticks `hermes`
- **THEN** every chart SHALL redraw without `hermes` sessions, the URL SHALL list the remaining harnesses, and the picker SHALL say the charts are computed in the browser

#### Scenario: Ticking the benchmark in
- **WHEN** the visitor ticks `eval:swe-bench`
- **THEN** every chart SHALL include the benchmark sessions, and the simulation figures SHALL say they show the paper's population whatever harnesses are selected

### Requirement: The rows stream in after the default view
Once the default view is drawn, the page SHALL load DuckDB and fetch the
weeks' row files one week at a time, newest first, at low priority, and
hand each fetched file to DuckDB, so a query on those weeks reads memory. A
file not yet fetched SHALL be read over HTTP ranges. Streaming SHALL NOT
delay the default view and SHALL stop when every week is in or the page is
left. A narrowed selection SHALL run as soon as it is made, whether or not
its weeks have streamed in. Streaming SHALL be switched on or off by one
named constant in one module, so a maintainer can turn it off without
touching anything else; with it off, every browser-computed selection reads
HTTP ranges and the picker does not mention streamed weeks.

#### Scenario: Streaming switched off
- **WHEN** the maintainer sets the streaming constant to off and deploys
- **THEN** the default view SHALL be unchanged, no row file SHALL be fetched until a selection is narrowed, and a narrowed selection SHALL read HTTP ranges

#### Scenario: Narrowing after the stream
- **WHEN** every week's files have streamed in and the visitor unticks a harness
- **THEN** every figure SHALL redraw without any Parquet range request

#### Scenario: Narrowing before the stream
- **WHEN** the visitor unticks a week two seconds after opening the page
- **THEN** the figures SHALL redraw from HTTP range reads of the weeks still selected, and streaming SHALL continue afterwards

## REMOVED Requirements

### Requirement: Choosing a scope
**Reason**: The scope is a function of the harness; the harness picker says
everything the scope switch said.
**Migration**: The scope switch, the `scope` URL key, the `scope` columns and
`selected_scopes` go; a `scope` key in an old link is read as the default.
