# Spec Delta

## Purpose

Two pages, a sticky header, and Open Data's look.

## MODIFIED Requirements

### Requirement: Navigation and the About page
The site SHALL have two pages, Explore (the landing page) and Session.
Both SHALL share one sticky header: the brand, the affiliation "Harvard
SEAS · MadSys Lab" linking to the lab, the in-page links Overview,
Figures, Session list and Cite, and the external links Dataset, Paper, Code
and Open Data (on a phone, the brand and the four in-page links alone, on
one row). The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page; the definitions live behind each card's control, the differences
from the paper in the repository's `docs/differences.md`, and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Session list link
- **THEN** the Explore page SHALL open at the session list with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls the Explore page
- **THEN** the header SHALL remain visible at the top

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, check-answers, deploy
deploy.sh         what make deploy runs
serve.py          what make serve runs: a local server that answers range requests
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json      sets ES modules for node --test; no dependencies
docs/             differences.md: where the site draws more simply than the paper
site_data/        builds site/data/ from a release folder: a file per kind and week, the indexes, the answers
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  js/shared/      the database, the selection, the libraries, formatting, charts, the histogram, the CDF, the table, the layout
  js/engine/      DuckDB in the page
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's sections and the session list
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's address, agent tree, facts card, legends, overlap grouping, token parts and chart frame
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, session, setup
  data/           built by make data and tracked: a clone serves the site without building
tests/            Python tests and node --test files
openspec/
```

#### Scenario: Generated data is never committed
- **WHEN** `site/data` changes after `make data`
- **THEN** it SHALL be committed with the change that needed it, and the repository test SHALL require it whole and current

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
be set in the display serif and keep their ratios to the base. The
360-pixel layout SHALL still fit without horizontal scrolling.

#### Scenario: The smallest text
- **WHEN** any page is opened at desktop width
- **THEN** the computed size of every text element SHALL be at least 14 px

#### Scenario: A phone
- **WHEN** the Explore page is opened 360 pixels wide
- **THEN** the page SHALL not scroll sideways

## ADDED Requirements

### Requirement: The look follows Open Data
The site SHALL use Open Data's tokens: the paper background `#f8f7f5`,
white surfaces, ink `#1c1917`, the rule `#e4dfdb`, the crimson accent
`#a51c30` with its dark and tint; Crimson Text for headings, the stat
numbers and the affiliation, Inter for body text, and the monospace
stack, uppercase and letter-spaced, for eyebrows, chips, the nav and the
cite caption. Cards SHALL carry a 1px rule, a soft shadow and a 0.9rem
radius. A dark scheme SHALL follow the visitor's system preference, with
the paper, surfaces and inks retuned dark. The eight series slots SHALL
be the same hues in both schemes, at least 30° apart in OKLCH, each at least 3:1 in
contrast against its scheme's card, and a test SHALL check every colour
token's contrast in both schemes. The parts of a session's time SHALL be
coloured as the paper colours them: prefill blue, decode orange, tool
green, user idle red.

#### Scenario: A heading
- **WHEN** any heading renders
- **THEN** its computed font family SHALL begin with Crimson Text

#### Scenario: Dark system scheme
- **WHEN** the visitor's system prefers a dark scheme
- **THEN** the page SHALL render on the dark paper with every series at least 3:1 against its card

#### Scenario: A series keeps its identity
- **WHEN** the same harness is drawn in light and in dark
- **THEN** it SHALL have the same hue in both
