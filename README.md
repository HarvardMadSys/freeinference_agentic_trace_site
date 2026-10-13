# FreeInference Agentic Dataset, visualized

A static website for exploring the FreeInference agentic trace, the dataset of
the paper *From Requests to Sessions: A Large-Scale Characterization of
Human-Driven Agentic Workloads*. Its Session Explorer lists every session and
opens any one to show how its context grew, what it cached, which tools it
called and which subagents it spawned; its Insights draw the paper's charts
over the paper's data, each with the one sentence it shows.

Everything runs in the browser. The site is a folder of HTML pages, ES
modules, JSON answers and gzipped JSON session buckets, with Observable Plot
drawing the charts; the Parquet files the data step reads ship beside them,
and no page fetches them. There is no server and no bundler.

## Pages

| Page | File | What it shows |
|---|---|---|
| Explore | `index.html` | The landing page: a hero with the stats strip (the whole trace as the paper's summary table counts it: weeks, sessions, requests, input tokens, tool calls, harnesses), the model and harness mixes and the weekly trends (Overview, `#overview`), the Session Explorer (`#sessions`), a table of every top-level session with its own filter, the Insights (`#insights`), 29 of the paper's figures and two histograms in six topics (`#insights-sessions`, `#insights-tokens`, `#insights-latency`, `#insights-tools`, `#insights-caching`, `#insights-comparison`: Session structure, Tokens and cost, Latency, Tools, Prefix caching, Human-driven against benchmark), the paper's citation (Cite, `#cite`) and the team (`#team`) |
| Session | `session.html` | One session and its subagents: a bar per request with each tool call's programs and the skeleton of its arguments, context over time, and a timeline per agent |

## Frozen figures

Every number on the Explore page, every trend, stat
and figure, is drawn over every week and the paper's
harnesses (every harness but the benchmark replay `eval:swe-bench`, which
appears only where a figure's legend names it), from answers precomputed
when the data are built; the stats strip and the Session Explorer, which
count the whole trace, are answered over every harness. `make data` runs
every query under `site/queries/explore/` and `site/queries/figures/` and
the colour orders under `site/queries/setup/` once with that selection, and
writes each answer as `site/data/all_weeks/<page>/<query>.json`; the Explore
page reads those files and nothing else, so it loads no DuckDB and no
Parquet file. **Rerun `make data` after editing any of those queries**: the page reads
the answer, not the query. `make data` records the hash of each query's
text in `all_weeks/queries.json`, and `make test` fails on a query edited
since (`tests/test_answers.py`), as `make deploy` does through
`make check-answers`.

The one thing a visitor narrows is the Session Explorer's list. Its answer holds every
harness's sessions, the benchmark's marked, and the list filters it in the
browser by month (the weeks whose Sunday falls in it), harness, main model,
a minimum of requests and a search of the session id, newest session first.
The month and harness drop-downs choose one of each, and the URL holds them
as `months` and `harnesses` (`?months=2026-07&harnesses=codex`), so a
filtered list can be shared as a link; the default, every month and every
harness, writes no key, and the keys change no figure. A key naming several
keeps its first; older links' `weeks`, `month`, `scope` and `harness` are
read as the filter and rewritten.

The browser query path stays in the code behind one switch:
`FIGURES_ARE_FROZEN` in `site/js/explore/start.js` is `true`. Set to
`false`, the page mounts the week and harness pickers again, and any
selection but the default is computed by DuckDB-WASM over the Parquet files
from the same queries. After the first view the page could then stream
every week's row files into memory so that a narrowed selection reads no
HTTP ranges; `STREAM_ROWS_AFTER_DRAW` in `site/js/shared/database.js` turns
that on, and is `false`.

The Session page runs no query. `make data` writes every session into
gzipped JSON buckets, `site/data/session_buckets/<week>/<xx>.json.gz`, `xx`
the first two characters of a top-level session's id, each holding the
rows of its top-level sessions and their subagents; beside them, the week's
`index.json.gz` maps every session id, subagents included, to its
top-level id. The page fetches the one bucket its id names, gunzips it in
the browser and draws; a subagent's id takes the index and its top-level
session's bucket, three fetches at most. It loads no DuckDB module, no
Parquet file and no SQL.

Measured on the shipped data (16 weeks), served by `serve.py` (which does
not compress) on the same machine, in headless Chromium, three runs each:

- The Explore page draws every trend, headline number,
  figure and the session list in 0.9–1.2 s (median 1.1 s). It makes 143
  requests: 91 to the site (the page and its style sheet, 44 modules, 45 data
  files: `weeks.json`, `harnesses.json` and 43 answers) and 52 to the CDN
  (Observable Plot with its modules, and the web fonts). The site's own files come to 5.2 MB,
  4.8 MB of them data and 4.0 MB the session list's answer; gzipped, as a
  static host serves them, 1.0 MB, plus 0.35 MB of libraries and fonts as the
  CDN sends them. No `.wasm` and no `.parquet` is fetched.
- The Session page draws the Requests view of its largest session (5,040
  requests, week of 2026-08-30) in 0.99–1.07 s (median 1.0 s), or 0.9 s
  with 40 ms of latency and 50 Mbit/s: 35 requests, 31 to the site (the
  page and its style sheet, 27 modules, and two data files: the session's
  bucket, 0.30 MB, and the category order) and 4 to the CDN for the web
  fonts. The site's files come to 0.54 MB, 0.38 MB as a gzipping host
  serves them. No `.wasm`, `.parquet` or `.sql` is fetched; the Context and
  Timeline views add Observable Plot from the CDN. Reading the week's
  Parquet files in DuckDB-WASM instead took 3.1 s, or 7.6 s with that
  latency and bandwidth, with 126 requests, 13.6 MB of data and 7.5 MB of
  libraries.

## Running it

The built data ships with the repository, so a clone serves the site as it is:

```bash
make serve           # http://localhost:8000, answering byte-range requests
make test            # the Python tests and the node tests (after make setup, below)
make setup-browser   # a headless Chromium and Playwright, for checking pages by hand; make test does not need it
make deploy          # publish site/ to Cloudflare as the Worker's static assets (after npm install and a Cloudflare login)
```

`site/data/` is 3,364 files and 168.4 MB: one Parquet file per kind of row
and week (requests 61.2 MB, tool calls 21.4 MB with each call's programs and
argument skeleton, sessions 1.3 MB, the cache simulation 0.1 MB), the two
indexes, 48 JSON files of answers and query hashes, 4.8 MB, and the session
buckets: 3,234 buckets and 16 week indexes, 79.6 MB gzipped, the median
bucket 15 KB and the largest 0.39 MB.

Rebuilding the data is the maintainer's step, when the release gains a
week, a column changes, or a query under `explore/`, `figures/` or
`buckets/` or a colour order changes. It takes the pipeline repository,
whose package
defines every number the site shows and whose `data/v1` holds the release
and the cache simulation of both the paper's harnesses and the benchmark
replay. Name it with `PIPELINE=` on the command line:

```bash
make setup PIPELINE=~/freeinference-agentic-pipeline   # a virtual environment with the pipeline's package and the test tools
make data PIPELINE=~/freeinference-agentic-pipeline    # site/data/ from its release: a Parquet file per kind of row and week, the indexes, the answers, the session buckets
make test PIPELINE=~/freeinference-agentic-pipeline    # with the paper-parity tests, which read its numbers.json and skip without it
make check-answers   # check that no query changed since make data wrote its answer; make test and make deploy run it
```

`PIPELINE` defaults to a checkout beside this repository,
`../freeinference-agentic-pipeline`. To build from a downloaded copy of the
dataset instead, name its folders:

```bash
make data RELEASE=~/freeinference_agentic_trace/release SIMULATION=~/freeinference_agentic_trace/simulation
```

The rebuilt data is committed with the change that needed it. A rebuild of the
same rows writes the same bytes, so git sees only what changed; one that
rewrites every week's files (a new column, an edited bucket query) adds up to
the data's size, about 170 MB, to the repository's history, so the data is
rebuilt when the release, a column or a query changes, not routinely.

### Hosting

The site is a Cloudflare Worker with static assets and no code of its own:
`wrangler.jsonc` names the Worker and points it at `site/`. Every push to
`main` deploys it through `.github/workflows/deploy.yml`, which runs
`wrangler deploy` with two repository secrets, `CLOUDFLARE_API_TOKEN` (a
token made from the dashboard's "Edit Cloudflare Workers" template) and
`CLOUDFLARE_ACCOUNT_ID`; set the repository variable
`CLOUDFLARE_ACCOUNT_SUBDOMAIN` and the workflow also checks the deployed
site. `make deploy` does the same from a machine with `npm install` done and
the token in `CLOUDFLARE_API_TOKEN`. Static assets allow 20,000 files of
25 MiB each; the site is about 3,400 files, the largest under 10 MB, and a
new week adds about 210.

Three things the host may do differently from `make serve`. It answers a
range request with the whole file (200, not 206): no page reads a range
while the figures are frozen, and with the switch off DuckDB accepts a whole
file where it asked for a range. It may serve a `.json.gz` file with its
gzip layer removed, which the Session page reads as plain JSON all the same.
And it redirects `page.html` to `page`, so `session.html?week=…` lands on
`/session?week=…` with its query kept.

## Layout

```
README.md          this file
CONTRIBUTING.md    the rules, the patterns, and how to add a query, a figure or a page
CLAUDE.md          a pointer to the two files above, the rules that matter most and the git rules
Makefile           setup · setup-browser · data · serve · test · check-answers · deploy
wrangler.jsonc     the Cloudflare Worker that serves site/ as static assets: its name, its hostnames
package.json       sets ES modules for node --test; wrangler, the one dev dependency, deploys the site
serve.py           what make serve runs: a local server that answers byte-range requests, as the host does
pyproject.toml     Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json       sets ES modules for node --test; no dependencies
docs/              differences.md: where the site draws more simply than the paper
site_data/         builds site/data/ from a release, and opens a database over it as the browser does
  __main__.py      the step make data runs: loads and checks every week, writes the files, the indexes, the answers,
                   the session buckets
  loading.py, weeks.py, harnesses.py
                   reading the release week by week; the indexes weeks.json and harnesses.json
  requests.py, tool_calls.py, sessions.py, session_tree.py, simulation.py
                   one module per kind of row, each column from the pipeline's functions
  site_database.py the browser's database in Python DuckDB: the views over the week files, the selection tables
  answers.py       the answers: every Explore and figure query and colour order, run once over every week and the
                   paper's harnesses; the session list's over every harness, the benchmark's marked
  buckets.py       the session buckets: every week's sessions, gzipped JSON by the first two characters of the
                   top-level id, and each week's index of session ids
  check_answers.py what make deploy checks first: every answered and bucket query's text is the one make data ran
  paths.py         the names of the folders and files the step writes
site/              exactly the files that are deployed
  *.html           one file per page: index (Explore, the landing page), session
  style.css        tokens, layout and components
  js/shared/       database (answer files and queries by name), selection (the selection
                   and its notes), libraries, format, charts, histogram (the histogram figures), cdf (the CDF
                   figures), table, layout (the header and footer)
  js/landing/      the Explore page's opening: hero (the title, lede and buttons), stats (the stats strip beside it),
                   donuts (the model and harness mixes), arcs (a donut's shares and ring segments), cite (the
                   citation's copy button) and team (the authors and the About paragraph)
  js/engine/       DuckDB in the page, kept behind the switch: duckdb_start (starting it), duckdb_views (its views and
                   setup), duckdb_files (the week files' names, and the stream of every week's files)
  js/theme/        colours, the site's colours as the style tokens give them
  js/axes/         ticks, the ticks of every chart's axes: how many, and where a log, duration or week axis ticks
  js/pages/        one module per page: explore, session
  js/explore/      the Explore page's start and sections: start (the start every Explore page shares, with
                   FIGURES_ARE_FROZEN), trends, figure_sections (the figure runner),
                   legend (the legend of buttons that hides and shows a series), sessions_table, sessions_table_state
                   (its columns and its state in the URL), sessions_filter (its month and harness filter), and
                   selection_pickers (the week and harness pickers, mounted only with the switch off)
  js/figures/      one module per figure section (sessions, tokens, latency, tools, caching), the modules they take
                   figures from (sessions_ranked, tools_batching, caching_gaps), and figure_rows, the row rules every
                   figure shares
  js/simulation/   the Prefix-caching section's figures of the cache simulation: prefill and costs
  js/comparison/   the figures that compare human-driven sessions with the benchmark's: the Human-driven-against-
                   benchmark section's module, comparison, the modules that draw them (scope_cdfs, tool_mix; the
                   user prompt size and the tool mix are listed in the Session-structure and Tools sections), and
                   scopes, the two scopes they compare
  js/session/      the Session page's bucket (a session's rows from its week's bucket, and the category order),
                   address, agent tree, facts, legends, overlap grouping, token parts and chart frame
  js/session_requests/  the Requests view: a row per request, its details (each call's programs and argument
                        skeleton), brackets and legend
  js/session_charts/    the Context and Timeline views, the series and bars they draw, their range slider and
                        the Timeline's pointer
  queries/         one .sql file per chart or table, in one folder per purpose: explore (12), figures (31: the 29
                   figures, and two per-model medians only the paper-parity test reads), buckets (3: the session
                   buckets' tree, requests and tool calls, run per week by make data), setup (17)
  data/            built by make data and tracked, so a clone serves the site without building
    requests/, tool_calls/, sessions/, simulation/
                   one folder per kind of row, with one file per week, week=<sunday>/rows.parquet; the simulation,
                   of both the paper's harnesses and the benchmark replay, only for the weeks it covers
    harnesses.json, weeks.json
                   the indexes of harnesses and weeks, read before anything else
    all_weeks/     the answers, <page>/<query>.json, and queries.json, each answered and bucket query's text hash
    session_buckets/
                   one folder per week, <sunday>/: the buckets <xx>.json.gz, the rows of the top-level sessions whose
                   ids start with xx and of their subagents, and index.json.gz, every session id to its top-level id
tests/             what make test runs
  conftest.py, fixture_release.py, site_database.py
                   a two-week fixture release, the site data built from it, and a database over it set up as
                   the browser sets it up (site_data/site_database.py, under the names the tests use)
  test_fixture_release.py   the fixture is a release the pipeline's reader accepts
  test_weeks.py, test_harnesses.py, test_loading.py, test_requests.py, test_sessions.py, test_session_tree.py,
  test_tool_calls.py, test_simulation.py, test_build.py, test_site_database.py, test_buckets.py
                   site_data's steps on the fixture release, against values counted by hand
  test_queries.py, test_explore_queries.py, test_figure_queries.py, test_session_figure_queries.py,
  test_caching_queries.py, test_caching_simulation_queries.py, test_comparison_queries.py
                   every .sql file run against the fixture data, its columns and its numbers
  test_answers.py           every answer make data writes for the fixture, against its query run live there; and the
                            shipped answers come from the queries' current text
  test_paper_parity.py, test_paper_parity_sessions.py, test_paper_parity_caching.py,
  test_paper_parity_comparison.py
                   on the shipped data, the numbers a figure shares with the paper's numbers.json
  test_pipeline_mirrors.py, test_pipeline_mirrors_caching.py
                   the pipeline constants the browser holds a copy of, against the pipeline's own
  test_differences.py       docs/differences.md holds the queries' and pipeline's numbers, and no figure
                            definition names the paper
  test_repository.py, test_serve.py
                   the repository's countable rules; make serve's byte ranges
  *.test.js        node --test, one file per JavaScript module with pure functions
openspec/          the specifications and the changes that built the site
```

## Where the numbers come from

Every definition comes from the pipeline. The ones the site shows (session,
turn, wait, cached share, idle gap) are computed by the pipeline's own
functions when `make data` runs. Where a query restates one in SQL (the cost
share's prices, the rank bins, the wait classes, what a tool wait is and how
long it counts for, the tool groups, the cache simulation's TTLs and costs, the
mutation table), a mirror test ties each copied constant to the pipeline's and a
parity test ties the number to the paper's; ten queries do,
`figures/cost_share_by_session.sql`, `figures/session_time_by_part.sql`,
`figures/speedup_if_twice_as_fast.sql`, `figures/calls_per_request_by_category.sql`,
`figures/latency_by_batch_width.sql`, `figures/tool_mix_by_turn_position.sql`,
`figures/prefill_against_storage.sql`, `figures/api_cost_by_ttl.sql`,
`figures/infrastructure_cost_by_ttl.sql` and `figures/mutations_by_cause.sql`;
the two time figures read a session's time breakdown from one view,
`setup/create_view_session_time.sql`.
Otherwise the queries, which `make data` runs
for the answers and the session buckets, only filter,
count, sum and take quantiles, and the session list only filters its
answer. Every number a figure shares with the paper equals the paper's, and
`tests/test_paper_parity*.py` checks each one against the shipped data.
`tests/test_pipeline_mirrors.py` checks that a mirror test reads each of the
ten queries and that this file, `CONTRIBUTING.md` and `CLAUDE.md` list
exactly them. Where a figure is drawn more simply than the paper,
`docs/differences.md` says how; the figure's Definition says what is drawn
and leaves the paper out.

- Dataset: https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace
- Pipeline: https://github.com/HarvardMadSys/freeinference_agentic_trace
