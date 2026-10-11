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

### Requirement: The browser query path is kept behind a switch
The code that lets the Explore page recompute its figures in the browser
(the pickers, the selection tables' filling, DuckDB's start, the stream)
SHALL stay in the repository with its tests, behind one named constant in
the Explore page's module, `FIGURES_ARE_FROZEN`, true. With it true, the
Explore page SHALL load no DuckDB module and no Parquet file; with it
false, the page SHALL behave as the archived change `one-page-all-weeks`
specified.

#### Scenario: The switch on
- **WHEN** `FIGURES_ARE_FROZEN` is true and the Explore page is opened
- **THEN** no `.wasm` and no `.parquet` SHALL be fetched

#### Scenario: The switch off
- **WHEN** `FIGURES_ARE_FROZEN` is false
- **THEN** the week and harness pickers SHALL be mounted and a narrowed selection SHALL recompute the figures in the browser
