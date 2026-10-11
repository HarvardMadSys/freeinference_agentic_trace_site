# Spec Delta

## Purpose

The pages are set in type large enough to read charts by, and the
repository no longer holds a browser query engine for the Explore page.

## ADDED Requirements

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
keep their ratios to the base. The 360-pixel layout SHALL still fit without
horizontal scrolling.

#### Scenario: The smallest text
- **WHEN** any page is opened at desktop width
- **THEN** the computed size of every text element SHALL be at least 14 px

#### Scenario: A phone
- **WHEN** the Explore page is opened 360 pixels wide
- **THEN** the page SHALL not scroll sideways

### Requirement: DuckDB only where a session is read
DuckDB-WASM SHALL be loaded by the Session page only. The Explore page
SHALL import nothing from `js/engine/`, and `js/engine/` SHALL hold only
what starting DuckDB and reading one week's files needs.

#### Scenario: The Explore page's imports
- **WHEN** the repository test scans the Explore page's module graph
- **THEN** no module under `js/engine/` SHALL be reachable from it
