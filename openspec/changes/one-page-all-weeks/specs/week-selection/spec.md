# Spec Delta

## Purpose

How a visitor chooses which weeks the site shows, how that choice is kept
in the URL across pages, and how it reaches every query: from precomputed
answers when every week is selected, from DuckDB otherwise.

## MODIFIED Requirements

### Requirement: Choosing weeks
The Explore page SHALL show a week picker listing every week of
`weeks.json`, grouped by month, with every week selected by default. The
visitor SHALL be able to untick and tick single weeks, a whole month at once,
and every week at once. With no week selected, the page SHALL say so instead
of drawing empty charts. While the selection is not every week, the picker
SHALL say that the charts are computed in the browser and may take a few
seconds.

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
`weeks=<sunday>,<sunday>…` or `month=<YYYY-MM>`, and SHALL be read from it
when a page opens. Every week selected SHALL write neither key. Links
between pages SHALL carry it, and the Session page SHALL carry it back to
Explore. A week in the URL that is not in `weeks.json` SHALL be ignored, and
the page SHALL say which. A `scope` key in the URL SHALL be ignored.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?month=2026-07`
- **THEN** the page SHALL open with July 2026's weeks selected

#### Scenario: An unknown week
- **WHEN** the URL names a week that is not in `weeks.json`
- **THEN** the page SHALL select the other weeks it names and show a note naming the unknown one

#### Scenario: A link from the first release
- **WHEN** a visitor opens a link with `?weeks=all&scope=All`
- **THEN** the page SHALL open with every week selected and the URL SHALL be rewritten without either key

### Requirement: The selection reaches queries as tables
A page SHALL answer a selection query from `data/all_weeks/` when every week
is selected, and from DuckDB otherwise. Before running a query in DuckDB, a
page SHALL fill the DuckDB table `selected_weeks(week)`, and on the Session
page `selected_session(week, root_session_id)`. Every query that depends on
the selection SHALL read it from those tables and from nothing else. DuckDB
SHALL NOT be loaded until a page has a query it cannot answer from a file.

#### Scenario: Every week
- **WHEN** every week is selected
- **THEN** no Parquet file and no DuckDB module SHALL be fetched, and every chart SHALL be drawn from its precomputed answer

#### Scenario: Changing the selection
- **WHEN** the visitor unticks one week
- **THEN** the page SHALL load DuckDB if it has not, fill `selected_weeks` and rerun only the queries, without reloading the page

## REMOVED Requirements

### Requirement: Choosing a scope
**Reason**: The site shows one population, the paper's Agentic scope; the
data step no longer holds the benchmark rows (`site-data`).
**Migration**: The scope switch and the `scope` URL key go; a `scope` key in
an old link is ignored.
