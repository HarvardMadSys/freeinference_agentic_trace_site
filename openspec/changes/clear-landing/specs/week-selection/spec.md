# Spec Delta

## Purpose

The session list filters by month only, over every harness.

## MODIFIED Requirements

### Requirement: The selection lives in the URL
The session list's filter SHALL be written to the URL's query string as
`months=<YYYY-MM>,<YYYY-MM>…`, and SHALL be read from it when the page
opens; it SHALL change nothing but the list. The default (every month)
SHALL write no key. The Session page SHALL carry the key back to Explore.
A month in the URL that the data do not hold SHALL be ignored, and the
list SHALL say which. A `harnesses=` key SHALL be read and dropped (every
harness is listed); a `month=` key SHALL be read as that month, a
`weeks=` key as the months its weeks fall in, a `scope` key or `weeks=all`
as the default; each SHALL be rewritten.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `?months=2026-07&harnesses=hermes,codex`
- **THEN** the session list SHALL list July 2026's sessions of every harness, the URL SHALL be rewritten as `?months=2026-07`, and every figure SHALL be as without the keys

#### Scenario: An unknown week
- **WHEN** the URL's `weeks=` names a week that is not in `weeks.json`
- **THEN** the list SHALL filter to the months of the other weeks it names and show a note naming the unknown one

#### Scenario: A link from the first release
- **WHEN** a visitor opens a link with `?weeks=all&scope=All`
- **THEN** the page SHALL open with the list unfiltered and the URL SHALL be rewritten without either key

#### Scenario: A link from an earlier release
- **WHEN** a visitor opens a link with `?weeks=2026-07-05,2026-07-12&scope=All`
- **THEN** the list SHALL filter to July 2026 and the URL SHALL be rewritten as `months=2026-07`
