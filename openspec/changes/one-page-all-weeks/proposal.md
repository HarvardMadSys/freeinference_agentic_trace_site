# Proposal

## Why

The first release opens on one week and computes every chart in the
browser. Opening every week takes 15 s on a local server (measured: the
fifteen figure queries read 129 MB of a 59 MB Parquet file, because each
scans its own columns of all 1.2 million requests and DuckDB-WASM keeps
nothing between queries) and would take longer through a CDN. Yet "every
week" is the view most visitors want first: it is the paper's view.

The site also splits what a visitor looks for across two pages, Explore and
Paper figures, with the same picker on both; it offers a scope switch where
a harness choice would say more; and its figures cannot be narrowed to the
harnesses or series a visitor cares about.

## What Changes

- **Every week is the default, and it is precomputed.** `make data` runs
  every selection query once, over every week and the paper's harnesses,
  with the same SQL the browser runs, and writes each answer as a small
  JSON file. A page that shows that default reads those files and never
  loads DuckDB. Only a visitor who narrows the selection runs the queries
  in the browser, and the page says so.
- **The rows stream in the background.** Once the default view is drawn,
  the page loads DuckDB and fetches the weeks' rows one week at a time,
  newest first, so a selection narrowed later runs on rows already in the
  browser. The data step writes one Parquet file per kind of row and week,
  so a week is one fetch.
- **Harnesses instead of scope.** The scope switch, the `scope` URL key and
  the `scope` columns go. In their place a harness picker lists every
  harness with its sessions; the paper's population (every harness but the
  SWE-Bench replay) is the default, and SWE-Bench can be ticked in like any
  other harness. Every row of the release stays in the data.
- **One page.** The Paper figures page folds into Explore: picker and
  trends, headline numbers, distribution cards, the paper's figures in
  three sections (Sessions, Tools, Prefix caching), and the sessions table
  at the very bottom. Each section is its own module.
- **Models per week.** The weekly trends gain a bar per week of requests
  stacked by model, beside sessions by harness and input tokens by cache.
- **Interactive figures.** Clicking a series in a figure's legend hides or
  shows it, without a query. Narrowing the harnesses redraws every figure.
- **The figures are the paper's.** Twenty figures, every one recomputed
  from the release's rows or the simulation's tallies:
  - kept: requests and steps per session, turn and session duration, tokens
    per request, token split by week, token growth with the context,
    context share by role, TTFT by model, tool latency by category, tool
    result size by category, hit ratio after an idle gap by provider,
    simulated hit ratio by TTL, dead over active cache by policy;
  - added: cost share by session (Figure 2d), decode time by model (the
    decode half of Figure 4a–b), session time by part (Figure 4c, without
    the prefill–decode split), hit ratio by gap bin (8a), gap by cause (8c),
    mean hit ratio by cause (8d), retained over active cache (10b);
  - changed: hit ratio after a context change becomes the paper's CDF of
    append against mutation (Figure 9);
  - removed: the tool overview table and tool calls per request (the Tools
    section keeps latency and result size only).
- **Figures draw when they scroll into view**, so a browser-computed
  selection shows its first figures in a few seconds.
- **Left out**, because they need a model the release does not carry:
  the prefill–decode split and the what-if speedups (4c, 4d); batching and
  straggler figures (6, 7, Tables 4–6); the mutation table's prefill column
  (Table 7); the cost curves (10a, 11, 12, 13b); user intents (16). The
  benchmark comparison (14, 15) draws two populations in one figure; with
  SWE-Bench a harness like any other it can come later as a figure with a
  fixed second series. The cost curves could follow from the tallies and
  the pipeline's prices by the same mechanism.

## Capabilities

### Modified Capabilities

- `week-selection`: weeks and harnesses; every week and the paper's
  harnesses by default; default answers come from the precomputed files,
  other selections from DuckDB over rows streamed in the background.
- `explore-page`: the one page: trends with models per week, headline
  numbers, distribution cards, the figure sections, the sessions table
  last; legend toggles.
- `site-data`: one Parquet file per kind of row and week; no `scope`
  column; a harness index; the precomputed answers folder.
- `site-repository`: layout without `figures.html`; navigation of the
  sections; the test that a precomputed answer equals the live query's.
- `session-page`: the facts strip without scope; the way back to the
  table.

### Removed Capabilities

- `figures-page`: its requirements move into `explore-page`.

## Impact

- `site_data/`: writes `data/<kind>/week=<sunday>/rows.parquet` instead of
  four files, drops `scope`, writes `harnesses.json`, and a new module runs
  every selection query over the default selection and writes
  `site/data/all_weeks/`. `duckdb` becomes a dependency of the data step.
- `site/`: `figures.html` and `js/pages/figures.js` go; `index.html` gains
  the figure sections; `selection.js` gains the harness picker and loses
  the scope; `database.js` gains the precomputed route and the background
  stream; four queries go, eight come, one changes; every query reads
  `selected_harnesses` instead of `selected_scopes`.
- Tests: every selection query is checked precomputed against live on the
  fixture; the parity test grows the new figures' numbers; the mirror tests
  grow the gap bins, the wait causes of the time-by-part figure and the
  benchmark harness name.
- The deployed data keep every row and gain under 2 MB of JSON.
