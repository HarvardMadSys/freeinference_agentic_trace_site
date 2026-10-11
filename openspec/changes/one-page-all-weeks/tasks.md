# Tasks

Every task ends with `make test` green and one commit. A task that adds a
query also adds it to the query test and, when the query has a precomputed
answer, to the answer test. A task that touches a view also checks it in a
browser at 360 px and at desktop width, in light and dark mode. Where a
task says "measure", the measurement goes into `design.md`.

## 1. Site data: one population, precomputed answers

- [ ] 1.1 Drop the benchmark rows and the `scope` columns: `site_data` keeps the sessions the pipeline's population puts in the Agentic scope, with their requests and tool calls, and the simulation's Agentic tallies with the week's `output_tokens` added; `weeks.json` is unchanged. Update the fixture tests (the fixture keeps its SWE-Bench session so the test can check it is left out) and the data step's printed summary. Verify on the fixture that no row of the benchmark session remains in any file and that the idle-gap values of the remaining rows are unchanged.
- [ ] 1.2 Add `site_data/answers.py`: opens the written Parquet files in DuckDB as `tests/site_database.py` does (one shared module for the setup, so the browser's setup files run in the browser's order in both places), fills `selected_weeks` with every week, runs every `.sql` under `queries/explore/` and `queries/figures/`, and writes `site/data/all_weeks/<page>/<query>.json`. `duckdb` moves from the test extras to the package's dependencies. Verify that a second run writes identical files and that the folder's size is printed.
- [ ] 1.3 Add `tests/test_answers.py`: for every query with an answer, the answer written for the fixture equals the live query with every week selected, column for column, with numbers compared as numbers. Verify it fails when the writer is made to round a column.

## 2. Selection without scope, answers before DuckDB

- [ ] 2.1 `js/shared/selection.js`: every week by default; no scope; `weeks=all` and `scope` in an old URL are read and dropped; the picker's note that a narrowed selection is computed in the browser. Move the node tests. Verify in the browser that opening `index.html` with no query selects every week and that `?weeks=all&scope=All` is rewritten to no keys.
- [ ] 2.2 `js/shared/database.js`: `runQuery(name)` reads `data/all_weeks/<name>.json` while every week is selected and runs DuckDB otherwise; DuckDB connects on the first live query, not on open; `selected_scopes` and its setup files go; every query under `explore/` and `figures/` loses its scope clause. Verify in the browser's network panel that the default page fetches no `.wasm` and no `.parquet`, and measure its load time and bytes.
- [ ] 2.3 Remove the scope from the setup views, `tests/site_database.py`, the mirror test of `SCOPE_MEMBERS` and the Session page's facts strip. Verify `make test`.

## 3. One page

- [ ] 3.1 Move the figure sections into `index.html` and `js/pages/explore.js`: title, picker and trends, headline numbers, Sessions, Tools, Prefix caching, sessions table last with an anchor; `figures.html` and `js/pages/figures.js` go; the header links Explore, each section, the table and About. Verify every link carries the selection and that the Session page's back link lands on the table with its state.
- [ ] 3.2 Remove the distribution cards: `js/explore/distributions.js`, `js/shared/histogram.js`, their sixteen queries and their tests. Verify no module imports them and `make test`.
- [ ] 3.3 Figures draw when in view: an `IntersectionObserver` per card starts a figure's query under a browser-computed selection; a selection change marks every card not drawn; with every week selected every figure draws at once. Verify in the browser that unticking a week with the Tools section below the fold queries the Tools figures only when scrolled to, and measure one month's time to first figure.

## 4. The figures

- [ ] 4.1 Remove `tool_overview`, `calls_per_request` and `token_split_by_week` (queries, draw functions, tests, parity keys). Verify `make test`.
- [ ] 4.2 `cost_share_by_session`: one query giving each rank bin's mean cached, uncached and output cost shares at the pipeline's prices (mirror test against `paper.metrics.prices`), with the bin count the pipeline's `binning.rank_bins` uses; a stacked area. Parity: the pooled shares. Verify on the fixture by hand for its sessions.
- [ ] 4.3 `decode_cdf_by_model`: the CDF of latency minus TTFT for the TTFT figure's models over trusted TTFTs, drawn as `ttft_cdf_by_model` is. Verify on the fixture that the medians equal hand-computed values.
- [ ] 4.4 `session_time_by_part`: per top-level session, model time (its requests' durations), tool waits and human waits (which `waited_for` values count where: a mirror test against the pipeline's `TOOL_WAITS` and `HUMAN_WAITS`), as shares, sessions ranked by human share, in rank bins; a stacked area whose definition says the paper splits model time into prefill and decode. Verify on the fixture by hand.
- [ ] 4.5 `hit_ratio_cdf_by_gap_bin`: the CDF of hit ratio per gap bin of `wait_s`, the bins mirrored against the pipeline's `GAP_BINS`; `gap_cdf_by_cause`: the CDF of `wait_s` per `waited_for`; `mean_hit_ratio_by_cause`. Parity: the median hit ratio per bin, the median gap per cause, the mean hit ratio per cause. Verify on the fixture by hand.
- [ ] 4.6 `hit_ratio_cdf_by_transition` replaces `hit_ratio_by_transition`: the CDF of hit ratio after an append and after a mutation. Parity: both medians. Verify on the fixture by hand.
- [ ] 4.7 `retained_over_active`: reusable and dead token-seconds over active token-seconds per TTL, `ttl_only` policy, summed over the selected weeks, drawn as `dead_over_active_by_policy` is. Verify on the fixture that one week's values equal the tallies' ratios.
- [ ] 4.8 Colours: one colour per cause and per transition across the figures, in `style.css` and `charts.js`. Verify in light and dark mode.

## 5. Words

- [ ] 5.1 About page: the site shows the paper's Agentic population; the gap bin and the wait causes defined in the pipeline's words; the list of figures drawn more simply than the paper; links without `figures.html`. Update `tests/test_about_page.py`. Verify every hand-written number against the code.
- [ ] 5.2 `README.md`, `CONTRIBUTING.md` and `CLAUDE.md`: the one page, the answers folder, how to add a figure (query, answer, draw function, tests), and that `make data` must follow a query edit. Verify the layout block against `git ls-files`.

## 6. Deploy

- [ ] 6.1 Range-request probe on the host (carried over): publish the data and a one-query page to `gh-pages`, run one narrowed-selection query, and check in the network panel that the Parquet responses are `206` and total well under the file size. Record the bytes in `design.md`. If range reads fail, stop and revisit decision 1 of the first release.
- [ ] 6.2 Check the deployed site end to end (carried over, with the new default): every page at 360 px and at desktop width, in light and dark mode; the default page fetches no DuckDB and no Parquet; a one-month selection draws its first figure in under five seconds; the largest session's Requests view opens in under two seconds. Record the measured bytes and times in `design.md`.
