# Proposal

## Why

The first release opens on one week and computes every chart in the
browser. Opening every week takes 15 s on a local server (measured: the
fifteen figure queries read 129 MB of a 59 MB Parquet file, because each
scans its own columns of all 1.2 million requests and DuckDB-WASM keeps
nothing between queries) and would take longer through a CDN. Yet "every
week" is the view most visitors want first: it is the paper's view.

The site also splits what a visitor looks for across two pages, Explore and
Paper figures, with the same picker on both, and it offers a scope switch
that the paper's figures do not need.

## What Changes

- **Every week is the default, and it is precomputed.** `make data` runs
  every selection query once, over every week, with the same SQL the
  browser runs, and writes each answer as a small JSON file. A page that
  shows every week reads those files and never loads DuckDB. Only a visitor
  who deselects weeks runs the queries in the browser, and the page says so.
- **No scope.** The site shows the paper's population: the Agentic scope,
  coding and assistant agents with the benchmark replay left out. The data
  step drops SWE-Bench rows and the `scope` columns; the scope switch, the
  `scope` URL key and the `selected_scopes` table go.
- **One page.** The Paper figures page folds into Explore: picker and
  trends, headline numbers, then the figures in three sections (Sessions,
  Tools, Prefix caching), and the sessions table at the very bottom. The
  distribution cards go: each quantity they showed is a paper figure or a
  headline number.
- **The figures are the paper's.** Nineteen figures, every one recomputed
  from the release's rows or the simulation's tallies:
  - kept: requests and steps per session, turn and session duration, tokens
    per request, token growth with the context, context share by role, TTFT
    by model, tool latency by category, tool result size by category, hit
    ratio after an idle gap by provider, simulated hit ratio by TTL, dead
    over active cache by policy;
  - added: cost share by session (Figure 2d), decode time by model (the
    decode half of Figure 4a–b), session time by part (Figure 4c, without
    the prefill–decode split), hit ratio by gap bin (8a), gap by cause (8c),
    mean hit ratio by cause (8d), retained over active cache (10b);
  - changed: hit ratio after a context change becomes the paper's CDF of
    append against mutation (Figure 9);
  - removed: the tool overview table and tool calls per request (the Tools
    section keeps latency and result size only), token split by week (the
    weekly trend already shows it).
- **Figures draw when they scroll into view**, so a browser-computed
  selection shows its first figures in a few seconds.
- **Left out**, because they need a model the release does not carry or a
  population the site no longer holds: the prefill–decode split and the
  what-if speedups (4c, 4d); batching and straggler figures (6, 7, Tables
  4–6); the mutation table's prefill column (Table 7); the cost curves
  (10a, 11, 12, 13b); the benchmark comparison (14, 15); user intents (16).
  The cost curves could be added later from the tallies and the pipeline's
  prices by the same mechanism.

## Capabilities

### Modified Capabilities

- `week-selection`: every week by default; no scope; every-week answers
  come from the precomputed files, other selections from DuckDB.
- `explore-page`: the one page: trends, headline numbers, the figure
  sections, the sessions table last; no distribution cards.
- `site-data`: Agentic rows only, no `scope` column; the precomputed
  answers folder.
- `site-repository`: layout without `figures.html`; navigation of two
  pages; the test that a precomputed answer equals the live query's.
- `session-page`: the facts strip without scope; the way back to Explore.

### Removed Capabilities

- `figures-page`: its requirements move into `explore-page`.

## Impact

- `site_data/`: drops SWE-Bench rows and `scope`; a new module runs every
  selection query over every week and writes `site/data/all_weeks/`.
  `duckdb` becomes a dependency of the data step, not only of the tests.
- `site/`: `figures.html` and `js/pages/figures.js` go; `index.html` gains
  the figure sections; `js/shared/selection.js` and `database.js` lose the
  scope and gain the precomputed route; four queries go, seven come, one
  changes; every query loses its scope clause.
- Tests: every selection query is checked precomputed against live on the
  fixture; the parity test grows the new figures' numbers; the mirror tests
  grow the gap bins and the wait causes of the time-by-part figure.
- The deployed data shrink slightly (the benchmark rows go) and gain under
  1 MB of JSON.
