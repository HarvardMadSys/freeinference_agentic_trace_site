# FreeInference Agentic Dataset, visualized

A static website for exploring the FreeInference agentic trace, the dataset of
the paper *From Requests to Sessions: A Large-Scale Characterization of
Human-Driven Agentic Workloads*. Its Session Explorer lists every session and
opens any one to show how its context grew, what it cached, which tools it
called and which subagents it spawned; its Insights draw the paper's charts
over the paper's data, each with the one sentence it shows.

The site is a folder of HTML pages, ES modules, JSON answers and gzipped
JSON session buckets, with Observable Plot drawing the charts in the
browser. There is no server code and no bundler.

## Pages

| Page | File | What it shows |
|---|---|---|
| Explore | `index.html` | The landing page: a hero with buttons to the Session Explorer and the Insights and the stats strip (the whole trace as the paper's summary table counts it: weeks, sessions, requests, input tokens, tool calls, harnesses), the model and harness mixes and the weekly trends (Overview, `#overview`), the Session Explorer (`#sessions`), a table of every top-level session with its own filter, sort and page in the URL (`?months=2026-07&harnesses=codex`), the Insights (`#insights`), 29 of the paper's figures and two histograms in six topics shown one at a time behind a row of tabs, the shown topic in the URL's hash (`#insights-sessions`, `#insights-tokens`, `#insights-latency`, `#insights-tools`, `#insights-caching`, `#insights-comparison`: Session structure, Tokens and cost, Latency, Tools, Prefix caching, Human-driven against benchmark), the paper's citation (Cite, `#cite`) and the team (`#team`) |
| Session | `session.html` | One session and its subagents: a bar per request with each tool call's programs and the skeleton of its arguments, context over time, and a timeline per agent |

## Where the pages get their data

Every number the pages show is computed ahead of time by `make data`. The
browser runs no query: it fetches the indexes (`weeks.json`,
`harnesses.json`), the answers and the session buckets, filters the session
list, hides thin bins and draws. Every figure of the Insights is drawn
over every week and the paper's harnesses (every harness but the benchmark
replay `eval:swe-bench`, which appears only where a figure's legend names
it); the stats strip, the Overview's mixes and trends and the Session
Explorer, which count the whole trace, are answered over every harness, the
benchmark replay among them as `swe-bench`. `make data` runs every query
under `site/queries/explore/` and `site/queries/figures/` and the colour
orders under `site/queries/setup/` once with that selection, and writes each
answer as `site/data/all_weeks/<page>/<query>.json`. A topic of the
Insights fetches its answers and draws its figures when its tab is first
shown, so every chart is drawn at its card's width.

The one thing a visitor narrows is the Session Explorer's list. Its answer holds every
harness's sessions, the benchmark's marked, and the list filters it in the
browser by month (the calendar month, in UTC, a session started in), harness, main model,
a minimum of requests and a search of the session id, newest session first.
The month and harness drop-downs choose one of each, and the URL holds them
as `months` and `harnesses` (`?months=2026-07&harnesses=codex`), so a
filtered list can be shared as a link; the default, every month and every
harness, writes no key, and the keys change no figure. A key naming several
keeps its first; older links' `weeks`, `month`, `scope` and `harness` are
read as the filter and rewritten.

The Session page runs no query either. `make data` writes every week's
sessions into gzipped JSON buckets, the top-level sessions whose ids share
their first two characters in one file, with an index per week from every
session id to its top-level id; the page fetches the one bucket its id
names, or, for a subagent's id, the index and then its top-level session's
bucket. The format is defined in `site_data/buckets.py`'s docstring.

## Running it

The built data ships with the repository, so a clone serves the site as it is:

```bash
make serve           # http://localhost:8000
make test            # the Python tests, the node tests and the snapshot test (after make setup, below)
make snapshots       # rewrite tests/snapshots/ when a change is meant to alter what a page shows
make setup-browser   # the headless Chromium the snapshot test opens the pages in; without it make test skips them
make deploy          # publish site/ to Cloudflare as the Worker's static assets (see Hosting)
```

The test tools `make setup` installs include Playwright, pinned to the
version whose Chromium wrote the snapshots; a virtual environment made
before Playwright joined them needs `make setup` again.

Rebuilding the data is the maintainer's step, when the release gains a
week, a column changes, or a query under `explore/`, `figures/` or
`buckets/` or a colour order changes. It takes the pipeline repository,
whose package defines every number the site shows and whose `data/v1` holds
the release and the cache simulation of both the paper's harnesses and the
benchmark replay. Name it with `PIPELINE=` on the command line:

```bash
make setup PIPELINE=~/freeinference-agentic-pipeline   # a virtual environment with the pipeline's package and the test tools
make data PIPELINE=~/freeinference-agentic-pipeline    # site/data/ from its release: the indexes, the answers, the session buckets
make test PIPELINE=~/freeinference-agentic-pipeline    # with the paper-parity tests, which read its numbers.json and data/v1/release and skip without them
```

`PIPELINE` defaults to a checkout beside this repository,
`../freeinference-agentic-pipeline`. To build from a downloaded copy of the
dataset instead, name its folders:

```bash
make data RELEASE=~/freeinference_agentic_trace/release SIMULATION=~/freeinference_agentic_trace/simulation
```

`make data` prints what it wrote: each index's rows, the answers' files and
bytes, and the buckets' count and size with the median and largest bucket.
The rebuilt data is committed with the change that needed it, with the
snapshots `make snapshots` rewrites from it. A rebuild of the same rows
writes the same bytes, so git sees only what changed; one that
rewrites every bucket (a new column, an edited bucket query) adds nearly the
whole of `site/data` to the repository's history, so the data is rebuilt
when the release, a column or a query changes, not routinely.

### Hosting

The site is a Cloudflare Worker with static assets and no code of its own:
`wrangler.jsonc` names the Worker and points it at `site/`. Every push to
`main` deploys it through `.github/workflows/deploy.yml`, which runs
`wrangler deploy` with two repository secrets, `CLOUDFLARE_API_TOKEN` (a
token made from the dashboard's "Edit Cloudflare Workers" template) and
`CLOUDFLARE_ACCOUNT_ID`; set the repository variable
`CLOUDFLARE_ACCOUNT_SUBDOMAIN` and the workflow also asks the deployed site
for the Explore page (`/`), `weeks.json` and the newest week's bucket index,
and fails on any answer but 200. `make deploy` publishes the same way from
a machine with `npm install` done and the token in `CLOUDFLARE_API_TOKEN`;
run `make test` first. Static assets allow 20,000 files of 25 MiB each:
`find site -type f | wc -l` counts the files deployed, and the largest is the
session list's answer, `site/data/all_weeks/explore/sessions_of_selection.json`.

Two things the host does differently from `make serve`. It may serve a
`.json.gz` file with its gzip layer removed, which the Session page reads as
plain JSON all the same. And it redirects `page.html` to `page`, so
`session.html?week=…` lands on `/session?week=…` and
`index.html?months=…#sessions` on `/?months=…#sessions`, with the query
kept; the pages link one another by their `.html` names.

## Layout

The one map of the repository's folders and files; `CONTRIBUTING.md` has
the rules, how the pieces fit together, and the patterns to copy.

```
README.md          this file
CONTRIBUTING.md    the rules, the patterns, and how to add a query, a section, a figure or a Session page column
CLAUDE.md          a pointer to the two files above, the rules that matter most and the git rules
Makefile           setup · setup-browser · data · serve · test · snapshots · deploy
.github/workflows/deploy.yml
                   deploys site/ on every push to main, then asks the published site for three files
.nvmrc             the Node version the workflow installs
wrangler.jsonc     the Cloudflare Worker that serves site/ as static assets: its name, its hostnames
package.json       sets ES modules for node --test; wrangler, the one dev dependency, deploys the site
package-lock.json  wrangler's exact version and its dependencies', which npm ci installs
pyproject.toml     Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest and Playwright (pinned) for tests
site_data/         builds site/data/ from a release, running the queries over its rows in memory
  __main__.py      the step make data runs: loads and checks every week, builds the frames, writes the indexes, the
                   answers, the session buckets
  loading.py, weeks.py, harnesses.py
                   reading the release week by week; the indexes weeks.json and harnesses.json
  requests.py, tool_calls.py, sessions.py, session_tree.py, simulation.py
                   one module per kind of row, each column from the pipeline's functions
  site_database.py the site's database in Python DuckDB: the four frames of rows as tables, the selection tables
  answers.py       the answers: every Explore and figure query and colour order, run once over every week and the
                   paper's harnesses; the Overview's, the session list's and its first page's over every harness;
                   each query's text hash, and the queries edited since the answers were written
  buckets.py       the session buckets: every week's sessions, gzipped JSON by the first two characters of the
                   top-level id, and each week's index of session ids
  paths.py         the names of the folders and files the step writes
site/              exactly the files that are deployed
  *.html           one file per page: index (Explore, the landing page) and session
  style.css        tokens, layout and components
  favicon.svg      the brand mark, for the browser tab
  js/shared/       answers (the indexes, and the answer files by query name), libraries, format, charts, histogram
                   (the histogram figures), cdf (the CDF figures), table, layout (the header and footer)
  js/landing/      the landing page's own parts: hero (the title, lede and buttons), stats (the stats strip beside
                   it), donuts (the model and harness mixes), arcs (a donut's shares and ring segments), cite (the
                   citation's copy button) and team (the authors)
  js/theme/        colours, the site's colours as the style tokens give them, and the colours every figure shares
  js/axes/         ticks, the ticks of every chart's axes: how many, and where a log, duration or week axis ticks
  js/pages/        one module per page: explore, session
  js/explore/      the Explore page's start and sections: start (the page's start), trends,
                   figure_sections (the figure runner), topic_tabs (the Insights' tabs, one topic shown at a time),
                   legend (the legend of buttons that hides and shows a series), sessions_table, sessions_table_state
                   (its columns and its state in the URL), and sessions_filter (its month and harness filter)
  js/figures/      one module per figure section (sessions, tokens, latency, tools, caching), the modules they take
                   figures from (sessions_ranked, tools_batching, caching_gaps), and figure_rows, the row rules every
                   figure shares
  js/simulation/   the Prefix-caching section's figures of the cache simulation: prefill and costs
  js/comparison/   the figures that compare human-driven sessions with the benchmark's: the Human-driven-against-
                   benchmark section's module, comparison, the modules that draw them (scope_cdfs, tool_mix; the
                   user prompt size and the tool mix are listed in the Session-structure and Tools sections), and
                   scopes, the two scopes they compare
  js/session/      the Session page's bucket (a session's rows from its week's bucket, and the category order),
                   address, agent tree, facts, legends, token parts and view_chart (the Context and Timeline
                   views' chart start and request click)
  js/session_requests/  the Requests view: a row per request, its details (each call's programs and argument
                        skeleton), the brackets that group overlapping requests, and its legend
  js/session_charts/    the Context and Timeline views, the series and bars they draw, and their range slider
  queries/         one .sql file per chart or table, in one folder per purpose: explore, figures (and two per-model
                   medians only the paper-parity test reads), buckets (the session buckets' tree, requests and tool
                   calls, run per week by make data), setup (the selection tables, the one view, the colour orders)
  data/            built by make data and tracked, so a clone serves the site without building
    harnesses.json, weeks.json
                   the indexes of harnesses and weeks, read before anything else
    all_weeks/     the answers, <page>/<query>.json, and queries.json, each answered and bucket query's text hash
    session_buckets/
                   one folder per week, <sunday>/: the buckets <xx>.json.gz, the rows of the top-level sessions whose
                   ids start with xx and of their subagents, and index.json.gz, every session id to its top-level id
tests/             what make test runs
  conftest.py, fixture_release.py, site_database.py
                   a two-week fixture release, the site data built from it, the fixture's frames and a database
                   over them (site_data/site_database.py, under the names the tests use)
  test_fixture_release.py   the fixture is a release the pipeline's reader accepts
  test_weeks.py, test_harnesses.py, test_loading.py, test_requests.py, test_sessions.py, test_session_tree.py,
  test_tool_calls.py, test_simulation.py, test_build.py, test_site_database.py, test_buckets.py
                   site_data's steps on the fixture release, against values counted by hand
  test_queries.py, test_explore_queries.py, test_figure_queries.py, test_session_figure_queries.py,
  test_caching_queries.py, test_caching_simulation_queries.py, test_comparison_queries.py
                   every .sql file run against the fixture data, its columns and its numbers
  test_answers.py           every answer make data writes for the fixture, against its query run live there; and the
                            shipped answers come from the queries' current text, so a query edited since fails
  test_paper_parity.py, test_paper_parity_sessions.py, test_paper_parity_caching.py,
  test_paper_parity_comparison.py
                   on the shipped answers, the numbers a figure shares with the paper's numbers.json
  test_pipeline_mirrors.py, test_pipeline_mirrors_caching.py
                   the pipeline constants the queries and modules hold a copy of, against the pipeline's own
  test_differences.py       no figure's definition names the paper
  test_repository.py        the repository's countable rules
  snapshot.py, snapshot_units.py, test_snapshot.py, test_snapshot_units.py
                   the snapshot test: twelve states of the pages opened in headless Chromium (the Explore page with
                   each topic shown, two fixed sessions in each view), each unit they show (a chart, a table, a legend,
                   a block of text) read as text and compared with tests/snapshots/
  snapshots/       one folder per page state, one text file per unit, rewritten by make snapshots
  *.test.js        node --test, one file per JavaScript module with pure functions
openspec/          the specifications and the changes that built the site
```

## Where the numbers come from

Every definition comes from the pipeline. The ones the site shows (session,
turn, wait, cached share, idle gap) are computed by the pipeline's own
functions when `make data` runs. A few figure queries restate a pipeline
definition in SQL, such as the cost share's prices; `CONTRIBUTING.md` lists
them, each with the mirror test that ties its copied constants to the
pipeline's. Otherwise the queries only filter, count, sum and take
quantiles, and the session list only filters its answer. Every number a
figure shares with the paper equals the paper's, and
`tests/test_paper_parity*.py` checks each one against the shipped answers.

A figure's Definition says what the site draws and leaves the paper out.
Where the site draws more simply than the paper:

- **Every figure**: a bin with fewer than 50 rows is hidden, and the figure
  says how many were; the paper also drops thin size bins, but merges an
  idle-gap bin of fewer than 20 requests into the next one.
- **Token growth with the context**: fixed power-of-two bins of the messages
  in a request, where the paper fits its bins to the data.
- **Context share by role**: each role's share of the input pooled per
  power-of-two bin of input tokens, tool definitions included, where the paper
  takes each request's share per bin of messages and its main figure leaves
  tool definitions out.
- **Token split by week**: plain token shares per week, where the paper
  weights tokens by price and ranks sessions; **Cost breakdown by session** does
  that, as the paper does, at the pipeline's prices: cached, uncached and
  output at 1 : 10 : 50.
- **Time to first token by model** and **Decode time by model**: the five
  models with most requests that are among the eight with most requests over
  every week, where the paper draws two fixed models, each with its decode
  time and an estimate of its queueing time; the site draws no queueing
  estimate.
- **Tool latency by category** and **Tool result size by category**:
  percentiles per category, where the paper also marks the mean.
- **Cache reuse by wait type**: each bar from 0%, where the paper starts its
  bars at 70% so that their differences show.
- **Cache reuse by provider**: the pipeline's fixed idle-gap bins, each
  drawn at its middle, a line for each of the eight providers with most
  requests, where the paper merges a thin bin into the next, draws each bin at
  its requests' median gap and shows the four providers with most idle gaps.

As in the paper, the hit ratio after a context change leaves out a switch to
another model or provider: it is routing, not a change of context.

- Dataset: https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace
- Pipeline: https://github.com/HarvardMadSys/freeinference_agentic_trace
