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

### 1. The default selection is precomputed by running the browser's SQL once

`make data` opens the Parquet files it has just written in Python DuckDB,
fills `selected_weeks` with every week and `selected_harnesses` with the
paper's harnesses, runs every `.sql` file under `queries/explore/` and
`queries/figures/`, and writes each answer as
`site/data/all_weeks/<page>/<query>.json`, a list of row objects. The
browser's database object, asked for a query while the selection is the
default, fetches that file instead of running the query.

The answer is the same by construction: one SQL text, two engines of the
same program. A test runs every query both ways on the fixture data and
compares the rows.

- *Alternative: per-week tallies with fixed bins, summed in the browser for
  any selection.* Every selection would be instant, but a CDF's median
  would come from a bin, so "every number equals the paper's" would become
  "within a bin". The first release's design decision 1 rejected this for
  the same reason, and it still holds. A visitor who narrows the selection
  asked for a computation and gets the exact one.
- *Alternative: one DuckDB-WASM instance per figure, so the queries run in
  parallel.* The queries are already issued together; what serialises them
  is the single worker, and what makes them slow is the bytes. Four
  instances would quadruple memory and WASM start-up to read the same
  bytes. Rejected.

The JSON is small: the fifteen figure answers of the first release total
under 300 KB, the sessions table of every week about 1 MB. The default page
therefore loads no DuckDB and no Parquet, and under 2 MB in all.

### 2. One Parquet file per kind of row and week, streamed in the background

The data step writes `data/<kind>/week=<sunday>/rows.parquet` for the four
kinds of row, and the views read each kind's folder as one table with the
week taken from the folder name (hive partitioning). A query on some weeks
opens only those weeks' files, which replaces the first release's
row-group reasoning with file names; a session is one file of each kind.

Once the default view is drawn, the page loads DuckDB and fetches the
weeks' files one week at a time, newest week first, at low priority, and
registers each fetched file with DuckDB as an in-memory buffer under its
path; a file not yet fetched is read over HTTP ranges as before. A narrowed
selection therefore runs on memory for the weeks already streamed and on
ranges for the rest, and the picker shows which weeks are in. Streaming
stops when every week is in or the visitor leaves the page. One named
constant in the database module turns it off, in case the bytes it sends
every visitor turn out not to be worth it; nothing else changes with it.

- *Alternative: keep one file per kind and prefetch row groups.* DuckDB-WASM
  cannot take part of a file as a buffer, and the browser's HTTP cache does
  not reliably serve a range from an earlier larger range, so there is no
  simple way to make a prefetch count. Rejected.
- *Alternative: fetch everything before drawing anything.* The default
  view would wait for 73 MB it does not need. Rejected.
- Cost: with 16 weeks the views open 64 files, each needing its footer (one
  small range read) the first time a query touches it; the streaming makes
  most of those reads memory reads. Measured at task 6.2.

### 3. Harnesses instead of scope

The pipeline's scope is a function of the harness: `SWE-Bench` for the
benchmark harness, `Agentic` for every other. So a harness picker says
everything the scope switch said, and more: the default is the paper's
population (every harness but the benchmark), ticking the benchmark in
gives the first release's `All`, and unticking some harnesses gives views
the paper does not have. The `scope` columns go; `selected_harnesses`
replaces `selected_scopes` in every query. The idle gap stays computed as
the paper computes it, over the Agentic top-level requests, with the
benchmark's computed over its own, so a row's value does not depend on the
picker.

The harness index `harnesses.json` (harness, sessions over every week,
whether it is the benchmark) is written by the data step, so the picker
draws before DuckDB; the benchmark harness's name is mirrored against the
pipeline.

### 4. One page, the dashboard first, the paper's figures next, the table last

The Explore page becomes: title, picker and trends, headline numbers,
distribution cards, the Sessions figures, the Tools figures, the Prefix
caching figures, the sessions table. The distribution cards and the paper's
figures overlap (tokens per request as a histogram and as a CDF); both stay
for now, and the overlap is for the maintainer to resolve by looking. Each
section is one module under `js/explore/` or `js/figures/`, mounted by
`js/pages/explore.js`.

### 5. Figures draw when they scroll into view; legends toggle series

With the default selection, every answer is a small file, so the page draws
every figure at once. With a browser-computed selection, a figure's query
starts when its card enters the viewport (an `IntersectionObserver`), and a
figure that has already drawn for the current selection is left alone.

A figure with more than one series draws its legend as buttons; clicking
one hides or shows that series by redrawing the chart from the rows it
already has, without a query. Hidden series are not kept in the URL.

### 6. The new figures, and where they are simpler than the paper

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
- **Requests per week by model** (a trend, not a paper figure): requests of
  the selected harnesses' top-level sessions per week, stacked by model,
  every week whatever weeks are selected, as the two existing trends are.
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

### 7. What stays

The Session page, its three views and its queries are untouched except for
the scope in its facts strip and the files it reads. The DuckDB-WASM pin
stays. The deploy step stays.

## Risks / Trade-offs

- **[A query file is edited and `make data` is not rerun]** → The default
  view would show the old answer while a narrowed selection shows the new.
  The test compares both ways on the fixture, so a mismatch cannot pass
  `make test`; on the deployed site, `make deploy` always follows
  `make data`.
- **[Streaming 73 MB to every visitor]** → It starts only after the default
  view is drawn, at low priority, and stops when the visitor leaves; a
  visitor who never narrows the selection has lost nothing visible. If a
  measurement at 6.2 shows it slows the default view, it waits for the
  page's first idle moment.
- **[A browser-computed selection stays slow before the stream has
  arrived]** → It is a choice the page announces, the default never pays
  it, and the first figures appear as they scroll into view.
- **[Twenty figures and eight cards on one page]** → Each section has a
  heading and the header links to it; the table keeps its own anchor.

## Migration Plan

- `make data` then `make deploy`; the `figures.html` URL disappears, so the
  README's and About page's links change with it; a `scope=` or
  `weeks=all` key in an old link is read and dropped.

## Open Questions

- None.
