# FreeInference agentic trace, visualized

A static website for exploring the FreeInference agentic trace, the dataset of
the paper *From Requests to Sessions: A Large-Scale Characterization of
Human-Driven Agentic Workloads*. It draws the paper's figures for any weeks
and harnesses you choose and opens any session to show how its context grew,
what it cached, which tools it called and which subagents it spawned.

Everything runs in the browser. The site is a folder of HTML pages, ES
modules, JSON answers and Parquet files: the default view is drawn from
answers computed when the data are built, and any other selection is
computed by DuckDB-WASM over the Parquet files, with Observable Plot drawing
the results. There is no server and no bundler.

## Pages

| Page | File | What it shows |
|---|---|---|
| Explore | `index.html` | The week and harness pickers, weekly trends, headline numbers, distribution cards, the paper's figures in three sections (`#figures-sessions`, `#figures-tools`, `#figures-caching`) and a searchable table of the selected sessions (`#sessions`) |
| Session | `session.html` | One session and its subagents: a bar per request, context over time, and a timeline per agent |
| About | `about.html` | What the site shows, definitions, where it draws more simply than the paper, how the data were built, and links |

The chosen weeks or month and harnesses live in the URL
(`?month=2026-07&harnesses=hermes,codex`), so any view can be shared as a
link; the default, every week and every harness but the benchmark replay
`eval:swe-bench` (the paper's population), writes no key.

## The default view and the stream

The default selection is answered from `site/data/all_weeks/`: `make data`
runs every Explore and figure query once with that selection, and the colour
orders under `setup/`, and writes each answer as
`site/data/all_weeks/<page>/<query>.json`, so the default page loads neither
DuckDB nor any Parquet file. **Rerun `make data` after editing any of those
queries**: the default view reads the answer, not the query, and no test sees
a stale answer in `site/data` (`tests/test_answers.py` checks the answers
written for the fixture).

Any other selection loads DuckDB-WASM and runs the same queries in the
browser. After the first view is drawn, the page streams every week's row
files into DuckDB's memory, newest week first, so a later narrowed selection
reads memory instead of HTTP ranges; `STREAM_ROWS_AFTER_DRAW` in
`site/js/shared/database.js` turns this off.

Measured on the full data (16 weeks) through `make serve` on the same
machine, in headless Chromium:

- The default page draws every number, figure and the table in 0.76–0.95 s
  from its answers (when measured, with 37 answers). The answers now total
  4.2 MB in 48 files, of which the sessions table is 3.6 MB (0.7 MB gzipped,
  as the host serves JSON); no DuckDB module and no Parquet file is fetched
  before the page is drawn.
- With one month selected (`?month=2026-07`) the first figure is drawn at
  3.8 s, most of it DuckDB-WASM starting; only the figures within a viewport
  height of view run their queries (4 when measured), the others when
  scrolled to, and once the stream is in they draw in about 0.5 s.
- The stream fetches 64 files, 68.7 MB, one at a time at low priority; on
  this machine it starts once DuckDB is up (about 2.5 s) and is in by about
  3.5 s. A one-harness change then redraws Explore's sections in 2.2 s with no
  range request, against 6.6 s and 34 MB of range reads before the stream is in.
- The Session page opens its largest session (5,040 requests) in 2.3 s warm,
  3.5 s cold, reading that week's files only; starting DuckDB is 1.4 s of it.

## Running it

```bash
make setup           # a virtual environment with the pipeline's package and the test tools
make data            # site/data/ from the release: a Parquet file per kind of row and week, the indexes, the answers
make serve           # http://localhost:8000, with the range requests DuckDB needs
make test            # the Python tests and the node tests
make setup-browser   # a headless Chromium and Playwright, for checking pages by hand; make test does not need it
make deploy          # publish site/ as the only commit of gh-pages on origin, force-pushed (git 2.42 or later)
```

`make data` reads the release and the cache simulation built by the pipeline
repository, `../freeinference-agentic-pipeline`. To build from a downloaded
copy of the dataset instead:

```bash
make data RELEASE=~/freeinference_agentic_trace/release SIMULATION=~/freeinference_agentic_trace/simulation
```

## Layout

```
README.md          this file
CONTRIBUTING.md    the rules, the patterns, and how to add a query, a figure or a page
CLAUDE.md          a pointer to the two files above and the git rules
Makefile           setup · setup-browser · data · serve · test · deploy
deploy.sh          what make deploy runs: copies site/ onto an orphan branch and force-pushes it
serve.py           what make serve runs: a local server that answers byte-range requests, as the host does
pyproject.toml     Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest for tests
package.json       sets ES modules for node --test; no dependencies
site_data/         builds site/data/ from a release, and opens a database over it as the browser does
  __main__.py      the step make data runs: loads and checks every week, writes the files, the indexes, the answers
  loading.py, weeks.py, harnesses.py
                   reading the release week by week; the indexes weeks.json and harnesses.json
  requests.py, tool_calls.py, sessions.py, session_tree.py, simulation.py
                   one module per kind of row, each column from the pipeline's functions
  site_database.py the browser's database in Python DuckDB: the views over the week files, the selection tables
  answers.py       the default selection's answers: every Explore and figure query and colour order, run once
  paths.py         the names of the folders and files the step writes
site/              exactly the files that are deployed
  *.html           one file per page: index (Explore), session, about
  style.css        tokens, layout and components
  js/shared/       the database, the selection, the libraries, formatting, charts, the histogram card, the table,
                   the stat strip, the header and footer
  js/engine/       DuckDB in the page: duckdb_start (starting it), duckdb_views (its views and setup),
                   duckdb_files (the weeks' files and their streaming in)
  js/pages/        one module per page
  js/explore/      the Explore page's sections, one module each: selection_pickers, trends, headline,
                   distributions, figure_sections (the figure runner), sessions_table; and legend, the legend
                   of buttons that hides and shows a series
  js/figures/      one module per figure section (sessions, tools, caching), the modules they take figures from
                   (sessions_latency, sessions_ranked, caching_gaps), and figure_rows, the row rules every figure
                   shares
  js/session/      the Session page's address, agent tree, facts, legends, overlap grouping and chart frame
  js/session_requests/  the Requests view: a row per request, its details, brackets and legend
  js/session_charts/    the Context and Timeline views and the series and bars they draw
  queries/         one .sql file per chart or table, in one folder per purpose: explore, figures, session, setup
  data/            generated by make data; never tracked
    requests/, tool_calls/, sessions/, simulation/
                   one folder per kind of row, with one file per week, week=<sunday>/rows.parquet; the simulation
                   only for the weeks it covers
    harnesses.json, weeks.json
                   the indexes of harnesses and weeks, read before DuckDB loads
    all_weeks/     the default selection's answers, <page>/<query>.json
tests/             what make test runs
  conftest.py, fixture_release.py, site_database.py
                   a two-week fixture release, the site data built from it, and a database over it set up as
                   the browser sets it up (site_data/site_database.py, under the names the tests use)
  test_fixture_release.py   the fixture is a release the pipeline's reader accepts
  test_weeks.py, test_harnesses.py, test_loading.py, test_requests.py, test_sessions.py, test_session_tree.py,
  test_tool_calls.py, test_simulation.py, test_build.py, test_site_database.py
                   site_data's steps on the fixture release, against values counted by hand
  test_queries.py, test_explore_queries.py, test_figure_queries.py, test_session_figure_queries.py,
  test_caching_queries.py
                   every .sql file run against the fixture data, its columns and its numbers
  test_answers.py           every answer make data writes for the fixture, against its query run live there
  test_paper_parity.py, test_paper_parity_sessions.py, test_paper_parity_caching.py
                   with the default selection, the numbers a figure shares with the paper's numbers.json
  test_pipeline_mirrors.py, test_pipeline_mirrors_caching.py
                   the pipeline constants the browser holds a copy of, against the pipeline's own
  test_about_page.py        the About page's hand-written numbers and lists, against the code's
  test_repository.py, test_deploy.py, test_serve.py
                   the repository's countable rules; make deploy against a local repository; make serve's byte ranges
  *.test.js        node --test, one file per JavaScript module with pure functions
openspec/          the specifications and the changes that built the site
```

## Where the numbers come from

Every definition the site shows (session, turn, wait, cached share, idle
gap) is computed by the pipeline's own functions when `make data` runs.
The browser, and the answers `make data` precomputes with the browser's own
queries, only filter, count, sum and take quantiles. With the default
selection, every number a figure shares with the paper equals the paper's,
and `tests/test_paper_parity*.py` checks each one.

- Dataset: https://huggingface.co/datasets/harvardMadsys/freeinference_agentic_trace
- Pipeline: https://github.com/HarvardMadSys/freeinference_agentic_trace
