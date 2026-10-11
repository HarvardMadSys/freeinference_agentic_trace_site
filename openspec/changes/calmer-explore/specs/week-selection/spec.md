# Spec Delta

## Purpose

The visitor chooses months and harnesses from a picker that stays out of
the way until it is wanted.

## REMOVED Requirements

### Requirement: Choosing weeks
**Reason**: weeks are too many to pick one by one; a month is the unit a
visitor thinks in, and every week of a month is drawn alike.
**Migration**: a `weeks=` link selects the months its weeks fall in.

## ADDED Requirements

### Requirement: Choosing months
The Explore page SHALL offer the months of `weeks.json`, each month being
the weeks whose Sunday falls in it, with every month selected by default.
The visitor SHALL be able to untick and tick single months and every month
at once; weeks SHALL NOT be picked singly. The selection SHALL still reach
the queries as weeks. With no month selected, the page SHALL say so instead
of drawing empty charts. While the selection is not the default, the picker
SHALL say that the charts are computed in the browser and which weeks'
rows have already been streamed in.

#### Scenario: Choosing a month
- **WHEN** the visitor keeps only July 2026 selected
- **THEN** every chart SHALL redraw for the weeks whose Sunday falls in July 2026, and the picker SHALL say the charts are computed in the browser

#### Scenario: Nothing selected
- **WHEN** the visitor unticks the last selected month
- **THEN** the charts SHALL be replaced by a note asking for at least one month

### Requirement: The picker folds away
The selection card SHALL show one line, the selection in words (the months
or "Every week" with the span's first and last month, and the harnesses or
"the paper's harnesses"), with a control that opens the choices. The
choices SHALL be closed when the page opens with the default selection and
open when it opens with any other.

#### Scenario: Opening the site
- **WHEN** a visitor opens the Explore page with no selection in the URL
- **THEN** the selection card SHALL be one line, every month SHALL be selected and every chart SHALL show every week

#### Scenario: A shared link
- **WHEN** a visitor opens a link with `?months=2026-07`
- **THEN** the choices SHALL be open with July 2026 ticked alone

## MODIFIED Requirements

### Requirement: The selection lives in the URL
The selection SHALL be written to the URL's query string as
`months=<YYYY-MM>,<YYYY-MM>…` and `harnesses=<name>,<name>…`, and SHALL
be read from it when a page opens. The default (every month, the paper's
harnesses) SHALL write no key. Links between pages SHALL carry it, and the
Session page SHALL carry it back to Explore. A month or harness in the URL
that the data do not hold SHALL be ignored, and the page SHALL say which.
A `month=` key SHALL be read as that month; a `weeks=` key SHALL select
the months its weeks fall in; a `scope` key or `weeks=all` SHALL be read as
the default; each SHALL be rewritten.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?months=2026-07&harnesses=hermes,codex`
- **THEN** the page SHALL open with July 2026's weeks and those two harnesses selected

#### Scenario: An unknown week
- **WHEN** the URL's `weeks=` names a week that is not in `weeks.json`
- **THEN** the page SHALL select the months of the other weeks it names and show a note naming the unknown one

#### Scenario: An unknown month
- **WHEN** the URL names a month that no week of `weeks.json` falls in
- **THEN** the page SHALL select the other months it names and show a note naming the unknown one

#### Scenario: A link from an earlier release
- **WHEN** a visitor opens a link with `?weeks=2026-07-05,2026-07-12&scope=All`
- **THEN** the page SHALL open with July 2026 selected and the URL SHALL be rewritten as `months=2026-07`
