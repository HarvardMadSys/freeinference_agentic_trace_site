# Design

Every module follows the repository's rules (`site-repository`):
- simple and readable before fast, and no optimisation without a measured
  need;
- plain HTML, CSS and ES modules, with no build step;
- names are words;
- functions ≤ 50 lines, modules ≤ 300;
- SQL is a literal, one query per file;
- every definition comes from the pipeline.

## Context

Measured on the first release, through a local server that answers range
requests, headless Chromium, until every figure is drawn:

| View | Time | Parquet bytes read |
|---|---|---|
| Explore, one week | 4.2 s | 8 MB |
| Figures, one week | 5.2 s | 24 MB |
| Explore, every week | 7.4 s | 46 MB |
| Figures, every week | 15.4 s | 133 MB |

Opening DuckDB-WASM is 2.1 s and 4.4 MB of that. The figure queries run one
after another take 12.8 s for every week; run concurrently, as the page
runs them, 15.4 s, because DuckDB-WASM executes on one worker and the
browser's reads then queue. Each per-request figure scans its own columns
of all 1.2 million requests (`hit_ratio` 10 MB, `start_ms` and `end_ms`
14 MB, the five role-token columns 16 MB), and DuckDB-WASM keeps no bytes
between queries, so the seven per-request figures read the file twice over.
Through a CDN, 725 range requests would cost more again.

## Decisions

### 1. Every week is precomputed by running the browser's SQL once

`make data` opens the Parquet files it has just written in Python DuckDB,
fills `selected_weeks` with every week, runs every `.sql` file under
`queries/explore/` and `queries/figures/`, and writes each answer as
`site/data/all_weeks/<page>/<query>.json`, a list of row objects. The
browser's database object, asked for a query while every week is selected,
fetches that file instead of running the query, and does not open DuckDB
until a query it cannot answer from a file arrives.

The answer is the same by construction: one SQL text, two engines of the
same program. A test runs every query both ways on the fixture data and
compares the rows.

- *Alternative: per-week tallies with fixed bins, summed in the browser for
  any selection.* Every selection would be instant, but a CDF's median
  would come from a bin, so "every number equals the paper's" would become
  "within a bin". The first release's design decision 1 rejected this for
  the same reason, and it still holds. The visitor who narrows the
  selection asked for a computation and gets the exact one.
- *Alternative: one DuckDB-WASM instance per figure, so the queries run in
  parallel.* The queries are already issued together; what serialises them
  is the single worker, and what makes them slow is the bytes. Four
  instances would quadruple memory and WASM start-up to read the same
  129 MB. Rejected.
- *Alternative: load the selected weeks' columns into one in-memory table
  once, then run the figures against it.* Halves the bytes of a
  browser-computed selection but keeps the default view slow. Not needed
  once the default is precomputed; recorded in case a browser-computed
  selection ever needs it.

The JSON is small: the fifteen figure answers of the first release total
under 300 KB, the sessions table of every week about 1 MB. The default
page therefore loads no DuckDB, no Parquet, and under 2 MB in all.

### 2. One population, no scope

The site shows the Agentic scope only. The data step keeps the sessions the
pipeline's population puts in that scope, with their requests and tool
calls, and the simulation's Agentic tallies; the `scope` columns go. The
idle gap, already computed per scope over that scope's top-level requests,
is unchanged for the rows that remain.

- *Alternative: keep the SWE-Bench rows in the files and never query
  them.* They would cost bytes in every range read that touches their row
  groups and a filter in every query, for a population no page shows.
  Rejected.
- What this gives up: the benchmark comparison figures (14, 15), which need
  the benchmark population, and opening a SWE-Bench session on the Session
  page.

### 3. One page, figures in the paper's order, the table last

The Explore page becomes: title, picker and trends, headline numbers, the
Sessions figures, the Tools figures, the Prefix caching figures, the
sessions table. The figure modules, the figure row rules and the figure
query folder stay as they are; only the page that mounts them changes. The
distribution cards go: input, uncached and output tokens per request are
the tokens-per-request CDF; requests per session is the counts CDF;
session duration is the duration CDF; cached fraction per request is the
hit-ratio CDF; turns and subagents per session are headline numbers and
columns of the sessions table.

### 4. Figures draw when they scroll into view

With every week selected, every answer is a small file, so the page draws
every figure at once. With a browser-computed selection, a figure's query
starts when its card enters the viewport (an `IntersectionObserver`), and
a figure that has already drawn for the current selection is left alone.
The first figures therefore appear in the time of their own queries, not
of all nineteen.

### 5. The new figures, and where they are simpler than the paper

Each new figure is one query and one draw function, as before. Where the
site differs from the paper, the figure's definition says so:

- **Cost share by session** (2d): each top-level session's cost split
  between cached input, uncached input and output at the pipeline's prices,
  sessions ranked by cached share and cut into rank bins as the pipeline's
  `binning.rank_bins` does. The pooled shares are compared with the paper.
- **Decode time by model**: the CDF of latency minus TTFT, for the models
  of the TTFT figure, over trusted TTFTs. The paper's queueing estimate is
  not drawn.
- **Session time by part** (4c): per top-level session, the shares of its
  time that are model time (its requests' durations), tool waits and human
  waits, with the pipeline's `TOOL_WAITS` and `HUMAN_WAITS` naming which
  causes count where; sessions ranked by human share, in rank bins. The
  paper splits model time into effective prefill and decode; the site does
  not.
- **Hit ratio by gap bin** (8a): the CDF of the hit ratio of requests in
  each of the pipeline's six `GAP_BINS` of the wait before the request.
- **Gap by cause** (8c): the CDF of the wait before a request by what it
  waited for; **mean hit ratio by cause** (8d): the mean hit ratio by the
  same.
- **Hit ratio after a context change** (9): the CDF of the hit ratio after
  an append and after a mutation, replacing the site's mean bars.
- **Retained over active cache** (10b): reusable and dead token-seconds over
  active token-seconds per TTL under the `ttl_only` policy, from the
  tallies summed over the selected weeks.

### 6. What stays

The Session page, its three views and its queries are untouched except for
the scope in its facts strip. The data step's files, ordering, row groups
and the DuckDB-WASM pin stay. The deploy step stays.

## Risks / Trade-offs

- **[A query file is edited and `make data` is not rerun]** → The
  every-week view would show the old answer while a narrowed selection
  shows the new. `make data` writes the answers beside the data, the test
  compares both ways on the fixture, and `make test` runs the data step on
  the fixture, so the mismatch cannot pass the tests; on the deployed site,
  `make deploy` always follows `make data`.
- **[A browser-computed selection stays slow]** → It is now a choice the
  page announces, the default never pays it, and the first figures appear
  as they scroll into view. The in-memory table of decision 1 is the next
  lever if a measurement asks for it.
- **[Nineteen figures on one page]** → Each section has a heading and the
  header links to it; the sessions table keeps its own anchor.

## Migration Plan

- `make data` then `make deploy`; the `figures.html` URL disappears, so the
  README's and About page's links change with it.

## Open Questions

- None.
