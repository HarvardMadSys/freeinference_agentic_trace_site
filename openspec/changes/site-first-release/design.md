# Design

Every module follows the repository's rules (`site-repository`):
- simple and readable before fast, and no optimisation without a measured
  need;
- plain HTML, CSS and ES modules, with no build step;
- names are words;
- functions ≤ 50 lines, modules ≤ 300;
- SQL is a literal, one query per file;
- every definition comes from the pipeline.

The decisions below are taken inside those rules.

## Context

**Release sizes**, measured on the 16 weeks from 2026-05-17 to 2026-09-05:
- The requests table is 1.8 GB for the latest week, but almost all of it is
  `block_ids`. Without `block_ids`, all 16 weeks come to 40.4 MB, between
  0.2 and 6.4 MB per week, for 1.19 M requests.
- The latest week's tool calls are 3.7 MB and its sessions 46 KB.
- There are 14,036 sessions, of which 2,034 are subagents. Every subagent is
  in its top-level session's week, session ids are unique across weeks, and
  subagents nest at most four deep.
- The cache simulation's per-week files are a few KB each, hold sums only,
  and cover only the Agentic scope.

**The paper's figures** are computed by `paper/metrics/*.py` over all weeks
at once and drawn with matplotlib. No per-week figure data exist. The
definitions the site needs are public functions in the pipeline:
- `turns.turn_numbers` and `turns.waits`;
- `tokens.uncached_tokens` and `tokens.is_cache_reporting`;
- `gaps.hit_ratio`, and `gaps.idle_gap_rows` with `gaps.IDLE_GAP_EDGES_S`;
- `latency.is_trusted_ttft`;
- `population.scope_of`.

**Reference sites.** SemiAnalysis's InferenceX AgentX pages are the closest
model:
- a dataset page of stats, percentile-marked histograms and a searchable
  conversation table;
- a conversation page of per-request stacked bars, with collapsible subagent
  groups, brackets for overlapping requests and deep links to a row.

Their charts are hand-written SVG and HTML, and their data are precomputed
JSON behind an API. The site takes their page structure and drops the API.

**The site is public.** It may show what the anonymous release shows and
nothing else, so no message text.

## Goals / Non-Goals

**Goals:**
- Any selection of weeks gets exact figures (true medians and percentiles),
  not approximations from pre-binned tallies.
- Every page draws its layout immediately; data arrive in seconds on an
  ordinary connection.
- Any view, down to one step of one session, can be shared as a link.
- A maintainer adds a week with `make data deploy`.

**Non-Goals:**
- The paper's other figures.
- Comparing sessions side by side.
- CSV export.
- Accounts.
- Server-side code.
- A simulated-cache view of a single session; the simulation appears only on
  the Paper figures page.
- Pixel-for-pixel copies of the paper's figures.
- Message text or tool arguments.

## Decisions

### 1. Rows in the browser, not precomputed figure data

The site ships the request, tool-call and session rows (without `block_ids`)
and computes each chart with one SQL query in DuckDB-WASM.

- *Alternative: precompute every figure and histogram per week in Python
  and ship small JSON, as InferenceX does per dataset.* This is lighter on
  the wire, but medians and percentiles do not add across weeks. Every
  figure would need fixed-bin tallies per week and an estimated quantile,
  which is a second implementation of every figure. A selection of weeks
  would no longer give the paper's numbers.
- *Alternative: one JSON file per session (14,036 files).* This duplicates
  the rows already in `requests.parquet`. Decision 2 makes a session's rows
  one row-group read, so the extra files buy nothing.

The rows are 40 MB in all, and a query reads only the columns and row groups
it needs, so most selections fetch a few MB. The cost is DuckDB-WASM itself
(decision 4).

### 2. One file per kind of row, sorted by week, root session and step

`requests.parquet` holds every week, sorted by `week`, `root_session_id`,
`session_id` and `step`, written one week at a time in row groups of
`ROWS_PER_GROUP = 100_000`, so a row group never spans two weeks.

- DuckDB skips row groups whose `week` or `root_session_id` range excludes
  the selection.
- "One logical table filtered by week" therefore costs the same as reading
  one week's file.
- A session's whole tree (the top-level session and every subagent, found by
  `root_session_id`) sits in one or two row groups.

Alternatives considered:
- *One file per week, combined by a view over a list of URLs.* DuckDB-WASM
  cannot list files over HTTP, so every page would first fetch a file list
  and register each file: a step with no gain at 40 MB.
- *pyarrow's default row group size.* Its default (about a million rows)
  would put several weeks in one group and defeat the skipping.
- *The release's own 10,000-row groups.* DuckDB-WASM reads a Parquet file
  over HTTP with one synchronous ranged request per column chunk, so small
  groups mean many round trips. Measured on the 16-week data against a
  range-capable local server, the Explore page's one-week and all-weeks
  counts together made 314 ranged reads of `requests.parquet` with
  10,000-row groups (6.8 MB; 15 s for the all-weeks load) and 56 with
  100,000-row groups (1.4 MB; 5.3 s including DuckDB's start-up). A week
  has between 7,000 and 190,000 requests, so it still fills one or two
  groups, and a session's whole tree sits in one of them.

DuckDB-WASM is pinned to 1.29.0. Measured the same way, 1.30.0 to 1.32.0
answer the same count with one un-ranged GET of the whole file (a
`count(*)` on a 1.8 GB file on Hugging Face started a full download), while
1.29.0 reads 1.2 MB in ranges. The browser itself passes `Range` headers,
so the change is in the library; re-measure before raising the version.

Measured on the 16-week release: `make data` takes 18.9 s and 5.1 GB of
memory at its peak, and writes 73.1 MB: `requests.parquet` 62.4 MB,
`tool_calls.parquet` about 9 MB, the sessions and simulation files under
1 MB (59.2 and 7.7 MB with 100,000-row groups). The requests file is larger than the 40 MB of the release's own
columns because of the derived columns: `hit_ratio` alone is 10.2 MB, and
`wait_s`, `idle_gap_s` and `uncached_tokens` another 11.6 MB. They are kept,
because the browser must not re-implement a pipeline definition; the levers,
when the file nears the host's 100 MB limit (at the current growth, about
eight more weeks), are splitting the file by week, or defining `hit_ratio`
once in the `requests` view and guarding it with the parity test. The
string columns are already dictionary-encoded and the 10,000-row groups
cost about 5 % over 100,000-row groups.

### 3. Every definition is computed in Python by the pipeline

`site_data`:
- loads the release with `release.reader.load`;
- adds `scope` with `population.scope_of`;
- adds `turn`, `wait_s`, `uncached_tokens`, `hit_ratio`, `idle_gap_s`,
  `idle_gap_bin` and `is_trusted_ttft` by calling the pipeline's functions;
  the idle gap is computed per scope over that scope's top-level requests,
  as the paper computes it over the Agentic population, so a subagent's
  request has none;
- adds `root_session_id` and `depth` by walking `parent_session_id`.

The browser filters, groups, counts, sums and takes quantiles, and lays out
a single session. It never decides what a turn or a hit is. The idle gap
looks back across weeks, so it is computed over all weeks before the rows
are sorted and written.

`site_data` depends on the pipeline as a Python package. `pyproject.toml`
points at the sibling folder, or at a git URL once the pipeline is public.
The release folder is an argument, so anyone can rebuild the site from the
downloaded dataset.

### 4. Plain HTML and ES modules; DuckDB-WASM and Observable Plot from a CDN

There are four HTML files, `index.html` (Explore), `figures.html`,
`session.html` and `about.html`. Each loads one module from `js/pages/`,
which imports shared modules from `js/shared/`:

- `libraries.js`: the only place CDN URLs appear. It exports `duckdb` and
  `Plot` from jsDelivr at exact versions.
- `database.js`: opens one DuckDB instance per page and registers
  `requests`, `tool_calls`, `sessions` and `simulation` as views over the
  Parquet URLs. It exports `runQuery(name)`, which fetches
  `queries/<name>.sql`, runs it and returns rows.
- `selection.js`: reads and writes the URL, fills the selection tables,
  draws the week picker and scope switch, and emits a `change` event.
- `table.js`: a sortable, filterable, paginated HTML table, in plain
  functions that are tested apart from the DOM.
- `histogram.js`: the distribution card, with bins, percentile lines and the
  "n · p50 · p90 · max" subtitle.
- `charts.js`: shared Plot defaults (fixed colours per model, category,
  policy and token part; the CDF helper; loading and error states).

The Session page has its own modules:
- `js/session/requests.js`: the bar list, drawn as HTML `div`s with widths
  in percent, as InferenceX does. It needs no chart library and stays
  readable.
- `js/session/context.js` and `js/session/timeline.js`: Plot charts.
- `js/session/overlaps.js`: groups requests whose intervals overlap. It is
  one plain sweep over at most a few thousand rows, tested with
  `node --test`.

Each figure section (`js/figures/sessions.js`, `tools.js`, `caching.js`)
exports a list of `{name, title, definition, draw(rows)}`. The Paper figures
page runs `runQuery(name)` and then `draw` for each entry.

Alternatives considered:
- *Observable Framework.* It has reactive cells and tables built in, but
  brings a build step and a framework dependency, and its static analysis of
  file references fights a data folder whose contents are chosen at runtime.
- *React with Next.js, as InferenceX uses.* It adds a router, a component
  library, a query cache and a build, none of which four static pages need.

DuckDB-WASM is the heaviest part, a few MB compressed, and the browser
caches it after the first visit. `weeks.json` and the HTML are enough to
draw each page's layout before it arrives.

### 5. Queries read the selection from tables; the sessions table sorts in JS

On each change, `selection.js` refills `selected_weeks(week)` and
`selected_scopes(scope)` through prepared `INSERT` statements. The Session
page fills `selected_session(week, root_session_id)`. A query is then a
plain literal:

```sql
-- Input tokens per request: the 50th, 75th, 90th and 95th percentile.
SELECT quantile_cont(prompt_tokens, [0.5, 0.75, 0.9, 0.95]) AS input_token_percentiles,
       count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes);
```

The sessions table loads every top-level session of the selection with one
query: at most 12,002 rows of about 15 columns. Sorting, searching,
filtering and paging then happen in `table.js` on that array. A sort column
chosen at runtime would otherwise need either SQL assembled from strings or
a `CASE` per column.

The tests create the same selection tables in Python DuckDB and run every
`.sql` file against fixture data, so a query is tested exactly as the browser
runs it.

- *Alternative: query parameters (`?`).* Each query would need its own
  argument list in JS, and a week list has no clean scalar form.

### 6. Where the site draws more simply than the paper

- **Size and idle-gap bins** are fixed: the pipeline's idle-gap edges, and
  powers of two for messages and input size. The paper fits them to the
  data's 99th percentile.
- **Thin bins are hidden** below `MIN_ROWS_PER_BIN = 50`, and the figure says
  how many were. The paper also drops thin size bins at the same threshold;
  it merges only a thin idle-gap bin (under 20 rows) into the next one.
- **Token split by week** shows plain token shares; the paper's cost split
  weights cached, uncached and output tokens by price.
- **Token split by week** replaces the paper's per-session rank-binned stack
  with one bar per selected week.

Each of these is stated in the figure's definition. The parity test compares
only the numbers the site and the paper share (medians, totals, shares),
which do not depend on binning.

### 7. Hosting

`make deploy` copies `site/` into a temporary worktree of an orphan
`gh-pages` branch, commits it as the branch's only commit, and force-pushes
it. Data never enter `main`, and the hosting branch holds one copy of the
data. GitHub Pages answers range requests and limits a file to 100 MB.

For local work, `make serve` runs `python -m http.server` in `site/`. It
does not answer range requests, so DuckDB-WASM downloads whole files (40 MB
from disk). That is fine locally, and it is why the range-request check runs
against the deployed site (task 2.1).

## Risks / Trade-offs

- **[Range reads through the host misbehave]** → The browser would download
  whole files, 40 MB of requests on a first visit, and cache them. Task 2.1
  probes this first; if it fails, split `requests.parquet` by week and
  measure again.
- **[The first visit downloads DuckDB-WASM]** (a few MB) → The layout draws
  first from `weeks.json`, and later visits use the browser cache.
- **[The release grows past what a browser handles comfortably]** → At an
  average of 2.5 MB per week, 52 weeks of requests are about 130 MB, still
  read column by column; the sessions table's array grows to about 40,000
  rows. Revisit when one file nears 100 MB (the host's limit).
- **[A very long session makes the Requests view slow]** → The bar list
  draws collapsed subagent groups, so the visible rows are the top-level
  session's. Measure the largest session before adding windowed rendering.
- **[Fixed bins differ slightly from the paper's fitted bins]** → Each
  definition says so, and the parity test covers the shared numbers.
- **[The pipeline's definitions change]** → `make data` recomputes, and the
  parity test against `numbers.json` catches a drift between the site and
  the paper.

## Migration Plan

There is no existing site to migrate.
- **First deploy:** run `make data deploy`, then enable GitHub Pages on the
  `gh-pages` branch.
- **Rollback:** redeploy from an earlier commit of `main` with the same
  release.

## Open Questions

- The GitHub owner and repository name for hosting. This changes only the
  deploy URL in the README.
- The exact DuckDB-WASM and Plot versions to pin: the newest release at
  least two weeks old when task 1.3 runs.
