## MODIFIED Requirements

### Requirement: Navigation and the About page
The site SHALL have four pages: Overview (`index.html`, the landing
page), Session Explorer (`explorer.html`), Insights (`insights.html`) and
Session (`session.html`).
All SHALL share one sticky header: the brand "FreeInference Agentic
Dataset" linking to the Overview page, the affiliation "Harvard SEAS ·
MadSys Lab" linking to the lab, the links Overview, Session Explorer,
Insights and Cite (the first three to their pages, Cite to the Overview
page's Cite section), the current page's link marked, and the
external links Dataset, Paper, Code
and Open Data (on a phone, the brand and the four site links alone, on
one row that scrolls sideways, its right edge faded while more links lie
beyond it). The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page; the definitions live behind each card's control, the differences
from the paper in the repository's `docs/differences.md`, and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Session Explorer link
- **THEN** the Session Explorer page SHALL open with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls any page
- **THEN** the header SHALL remain visible at the top

#### Scenario: The current page
- **WHEN** the visitor is on the Insights page
- **THEN** the header's Insights link SHALL be marked and the others not

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, check-answers, deploy
wrangler.jsonc    the Cloudflare Worker that serves site/ as static assets
serve.py          what make serve runs: a local server that answers range requests
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json      sets ES modules for node --test; wrangler, the one dev dependency
docs/             differences.md: where the site draws more simply than the paper
site_data/        builds site/data/ from a release folder: a file per kind and week, the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Overview, the landing page), explorer (Session Explorer), insights, session
  style.css       tokens, layout and components
  js/shared/      the database, the selection, the libraries, formatting, charts, the histogram, the CDF, the table, the layout
  js/engine/      DuckDB in the page, behind the Explore pages' switch
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore pages' shared start and their sections: the trends, the session list, the figure sections, the pickers
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's bucket loader, address, agent tree, facts card, legends, overlap grouping, token parts and chart frame
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, buckets, setup
  data/           built by make data and tracked, the session buckets included: a clone serves the site without building
tests/            Python tests and node --test files
openspec/
```

#### Scenario: Generated data is never committed
- **WHEN** `site/data` changes after `make data`
- **THEN** it SHALL be committed with the change that needed it, and the repository test SHALL require it whole and current

### Requirement: The browser query path is kept behind a switch
The code that lets the Explore pages recompute their figures in the browser
(the pickers, the selection tables' filling, DuckDB's start, the stream)
SHALL stay in the repository with its tests, behind one named constant in
the Explore pages' shared start module, `FIGURES_ARE_FROZEN`, true. With it true, no
Explore page SHALL load a DuckDB module or a Parquet file; with it
false, each page SHALL mount the pickers and recompute its own sections
as the archived change `one-page-all-weeks` specified, the selection
travelling between pages in the URL keys the header's links carry. The
Session page SHALL have no DuckDB path: it reads its
session from a bucket, and the database module SHALL keep no code only
the Session page used.

#### Scenario: The switch on
- **WHEN** `FIGURES_ARE_FROZEN` is true and any Explore page is opened
- **THEN** no `.wasm` and no `.parquet` SHALL be fetched

#### Scenario: The switch off
- **WHEN** `FIGURES_ARE_FROZEN` is false
- **THEN** the week and harness pickers SHALL be mounted on each Explore page and a narrowed selection SHALL recompute that page's sections in the browser

#### Scenario: The Session page
- **WHEN** any session is opened
- **THEN** no `.wasm`, `.parquet` or `.sql` SHALL be fetched, whatever the switch

### Requirement: Deployment
`make deploy` SHALL publish `site/`, including its generated data, to the
Cloudflare Worker that `wrangler.jsonc` names, which serves `site/` as
static assets. The host answers a range request with the whole file; the
Session page SHALL work on such a host, reading its week's files whole. A push to
`main` SHALL deploy the same way through the repository's deploy workflow,
which SHALL then ask the published site for each Explore page (`/`,
`/explorer`, `/insights`) and one data file, and fail on any answer but
200.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

#### Scenario: A page missing after a deploy
- **WHEN** the published site answers `/insights` with 404
- **THEN** the deploy workflow SHALL fail naming that path
