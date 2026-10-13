## REMOVED Requirements

### Requirement: The selection lives in the URL
**Reason**: The keys of earlier releases (`weeks`, `month`, `scope`) were never in a public link; reading and rewriting them is code and tests for nothing.
**Migration**: The filter's eight keys stay as they are; an old key is ignored and left in place.

## ADDED Requirements

### Requirement: The filter lives in the URL
The session list's filter SHALL be written to the Explore page's
URL query string as
`months=<YYYY-MM>` and `harnesses=<name>` (one of each, as the drop-downs
choose), and SHALL be read from it when the page opens; it SHALL change
nothing but the list. A month SHALL keep the sessions whose start, in UTC, falls in that calendar month, and the month drop-down SHALL list every calendar month from the first week's Sunday to the last week's Saturday. The default (every month, every harness) SHALL
write no key. The Session page SHALL carry the keys back to the Explore
page's Session Explorer. A
month or harness in the URL that the data do not hold SHALL be ignored,
and the list SHALL say which. A key naming several months or harnesses
SHALL keep its first and be rewritten. No other key SHALL be read or
rewritten: the filter's keys are `months`, `harnesses`, `model`,
`min_requests`, `search`, `sort`, `direction` and `page`.

#### Scenario: Sharing a view
- **WHEN** a visitor opens a link with `index.html?months=2026-07&harnesses=hermes,codex`
- **THEN** the session list SHALL list July 2026's `hermes` sessions, the URL SHALL be rewritten as `?months=2026-07&harnesses=hermes`, and every figure SHALL be as without the keys

#### Scenario: A session at a week's end
- **WHEN** the visitor picks May 2026
- **THEN** a session started June 6 in the week of May 31 SHALL NOT be listed, and September 2026 SHALL be an option that lists the sessions started September 1 to 5

#### Scenario: An old key
- **WHEN** a visitor opens a link with `?weeks=2026-07-05&scope=All`
- **THEN** the page SHALL open with the list unfiltered and leave the keys in the URL as they are
