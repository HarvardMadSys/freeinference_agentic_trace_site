## REMOVED Requirements

### Requirement: The browser query path is kept behind a switch
**Reason**: The path was never reached and the row files it read are no longer shipped; keeping it cost a third of the Explore page's code.
**Migration**: The Explore page reads the precomputed answers and nothing else. A future need to compute in the browser is a new change.

## RENAMED Requirements
- FROM: `### Requirement: Navigation and the About page`
- TO: `### Requirement: Navigation`

## MODIFIED Requirements

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, where the numbers come from, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, deploy
wrangler.jsonc    the Cloudflare Worker that serves site/ as static assets
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json      sets ES modules for node --test; wrangler, the one dev dependency
site_data/        builds site/data/ from a release folder: the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  favicon.svg     the brand mark, for the browser tab
  js/shared/      the answers, formatting, charts, the histogram, the CDF, the table, the layout
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's start and its sections: the trends, the session list, the figure sections, the topic tabs
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's bucket loader, address, agent tree, facts card, legends, token parts and chart frame
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, buckets, setup
  data/           built by make data and tracked: the indexes, the answers, the session buckets; a clone serves the site without building
tests/            Python tests and node --test files
openspec/         the specs and the open changes; archived changes live in git history
```

#### Scenario: Generated data is never committed
- **WHEN** `site/data` changes after `make data`
- **THEN** it SHALL be committed with the change that needed it, and the repository test SHALL require it whole and current

### Requirement: Deployment
`make deploy` SHALL publish `site/`, including its generated data, to the
Cloudflare Worker that `wrangler.jsonc` names, which serves `site/` as
static assets. A push to
`main` SHALL deploy the same way through the repository's deploy workflow,
which SHALL then ask the published site for the Explore page (`/`), the
weeks index and the newest week's bucket index, and fail on any answer
but 200.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

#### Scenario: A page missing after a deploy
- **WHEN** the published site answers `/` with 404
- **THEN** the deploy workflow SHALL fail naming that path

### Requirement: The built data ships with the repository
Git SHALL track `site/data` as `make data` built it: the indexes, the
answers, the query hashes, and every week's session
buckets and bucket index. The shipped data SHALL be whole, with a tracked
bucket index for every week in
`weeks.json`, and current, with every answer written from its query's
current text; `make test` SHALL fail otherwise. Rebuilding the data
remains `make data` from the pipeline repository, and the rebuilt data is
committed with the change that needed it.

#### Scenario: Serving a fresh clone
- **WHEN** the repository is cloned and `make serve` runs
- **THEN** every released week SHALL be shown, and every session opened, without building anything

#### Scenario: A query edited without rebuilding
- **WHEN** the text of an answered or bucket query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: A week built but not added
- **WHEN** `weeks.json` names a week whose bucket index is not tracked
- **THEN** the repository test SHALL fail naming the file
