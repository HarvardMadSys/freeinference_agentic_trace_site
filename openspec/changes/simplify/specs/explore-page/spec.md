## MODIFIED Requirements

### Requirement: Headline numbers
The headline numbers SHALL be the stats strip of the hero and nothing
else; no separate tile strip and no population line SHALL be drawn.

#### Scenario: Every week, scope All
- **WHEN** the page draws
- **THEN** the stats strip SHALL show the counts over every week and every harness, the benchmark's included

### Requirement: The page appears before the data
The Explore page SHALL draw its layout from `weeks.json` and
`harnesses.json` first, then every number, card, the table's first page
and the shown topic's figures from the precomputed answers, the table's
first page from its own answer without waiting for the full session
list, each part
showing a loading state until its answer arrives and its error in its
own place if the answer fails, without stopping the others. The page
SHALL run no query and load no database.

#### Scenario: The default view
- **WHEN** a visitor opens the page
- **THEN** every number, card, the table's first page and the shown topic's figures SHALL be drawn from `data/all_weeks/`, and no database module, no row file and no query file SHALL be fetched

#### Scenario: A slow connection
- **WHEN** an answer file takes several seconds to download
- **THEN** the page SHALL already show its layout, with a loading state in that answer's place and the other parts drawn
