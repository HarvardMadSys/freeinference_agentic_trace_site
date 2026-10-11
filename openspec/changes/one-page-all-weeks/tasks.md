# Tasks

Every task ends with `make test` green and one commit. A task that adds a
query also adds it to the query test and, when the query has a precomputed
answer, to the answer test. A task that touches a view also checks it in a
browser at 360 px and at desktop width, in light and dark mode. Where a
task says "measure", the measurement goes into `design.md`.

## 1. Site data: a file per week, harnesses, precomputed answers

- [ ] 1.1 Write one Parquet file per kind of row and week at `<kind>/week=<sunday>/rows.parquet`, the week read from the folder name; drop the `scope` columns and add `harness` to requests and tool calls; keep every session, the benchmark's included; the simulation files hold the Agentic tallies with the week's `output_tokens` added. The setup views read each kind's folder with hive partitioning. Update the fixture tests and the step's printed summary. Verify on the fixture that each week's file holds that week's rows only and that the idle-gap values are unchanged.
- [ ] 1.2 Write `harnesses.json` (`{harness, sessions, benchmark}`, most sessions first), with `benchmark` from the pipeline's population and a mirror test of the benchmark harness's name. Verify on the fixture that SWE-Bench is the one benchmark harness.
- [ ] 1.3 Add `site_data/answers.py`: opens the written files in DuckDB as `tests/site_database.py` does (one shared module for the setup, so the browser's setup files run in the browser's order in both places), fills `selected_weeks` with every week and `selected_harnesses` with every non-benchmark harness, runs every `.sql` under `queries/explore/` and `queries/figures/`, and writes `site/data/all_weeks/<page>/<query>.json`. `duckdb` moves from the test extras to the package's dependencies. Verify that a second run writes identical files and that the folder's size is printed.
- [ ] 1.4 Add `tests/test_answers.py`: for every query with an answer, the answer written for the fixture equals the live query with the default selection, column for column, with numbers compared as numbers. Verify it fails when the writer is made to round a column.

## 2. Selection: weeks and harnesses, answers before DuckDB, rows streamed after

- [ ] 2.1 `js/shared/selection.js`: every week and the non-benchmark harnesses by default; the harness picker (each harness with its sessions, the benchmark marked; select all, select the default); URL keys `weeks`/`month` and `harnesses`, none for the default; `weeks=all` and `scope` read as the default and dropped; the picker's note that a narrowed selection is computed in the browser, with the weeks streamed in so far. Move the node tests. Verify in the browser that opening `index.html` with no query selects the default, that `?weeks=all&scope=All` is rewritten to no keys, and that unticking Hermes writes `harnesses=`.
- [ ] 2.2 `js/shared/database.js`: `runQuery(name)` reads `data/all_weeks/<name>.json` while the selection is the default and runs DuckDB otherwise; `selected_harnesses` replaces `selected_scopes` in the setup files and in every query under `explore/` and `figures/`; DuckDB connects on the first live query or when streaming starts. Verify in the browser's network panel that the default page fetches no `.wasm` and no `.parquet` before it is drawn, and measure its load time and bytes.
- [ ] 2.3 Background streaming: after the default view is drawn, fetch each week's four files newest first at low priority and register each with DuckDB under its path as a buffer; a file not yet fetched is read over HTTP ranges; the picker shows the weeks streamed in; streaming stops when every week is in or the page is hidden; one named constant (`STREAM_ROWS_AFTER_DRAW`, in the database module, with a comment saying what it decides) turns it off, and with it off nothing is fetched until a selection is narrowed. Verify with the constant off that no row file is fetched on the default view, then in the network panel that a harness change after the stream makes no Parquet range request, and measure the stream's total bytes and the time a one-harness change takes before and after it.
- [ ] 2.4 Remove the scope from `tests/site_database.py`, the mirror test of `SCOPE_MEMBERS` and the Session page's facts strip; the Session page reads the per-week files. Verify `make test` and that the largest session still opens in under two seconds.

## 3. One page

- [ ] 3.1 Move the figure sections into `index.html` and `js/pages/explore.js`: title, pickers and trends, headline numbers, distribution cards, Sessions, Tools, Prefix caching, sessions table last with an anchor; `figures.html` and `js/pages/figures.js` go; the header links Explore, each section, the table and About. Verify every link carries the selection and that the Session page's back link lands on the table with its state.
- [ ] 3.2 Requests per week by model: `explore/requests_per_week_by_model.sql` and a third trend bar, in the model colours the figures use. Verify on the fixture that a week's segments sum to its requests.
- [ ] 3.3 Figures draw when in view: an `IntersectionObserver` per card starts a figure's query under a browser-computed selection; a selection change marks every card not drawn; with the default selection every figure draws at once. Verify in the browser that unticking a week with the Tools section below the fold queries the Tools figures only when scrolled to, and measure one month's time to first figure.
- [ ] 3.4 Legends toggle series: one legend component in `charts.js` whose entries are buttons; a hidden series is struck through and left out of the redraw; the hidden set resets on a selection change; used by every multi-series figure and trend. Verify in the browser on the sessions-per-week trend and the TTFT figure, and add node tests for the hidden-set logic.

## 4. The figures

- [ ] 4.1 Remove `tool_overview` and `calls_per_request` (queries, draw functions, tests, parity keys). Verify `make test`.
- [ ] 4.2 `cost_share_by_session`: one query giving each rank bin's mean cached, uncached and output cost shares at the pipeline's prices (mirror test against `paper.metrics.prices`), with the bin count the pipeline's `binning.rank_bins` uses; a stacked area. Parity: the pooled shares. Verify on the fixture by hand for its sessions.
- [ ] 4.3 `decode_cdf_by_model`: the CDF of latency minus TTFT for the TTFT figure's models over trusted TTFTs, drawn as `ttft_cdf_by_model` is. Verify on the fixture that the medians equal hand-computed values.
- [ ] 4.4 `session_time_by_part`: per top-level session, model time (its requests' durations), tool waits and human waits (which `waited_for` values count where: a mirror test against the pipeline's `TOOL_WAITS` and `HUMAN_WAITS`), as shares, sessions ranked by human share, in rank bins; a stacked area whose definition says the paper splits model time into prefill and decode. Verify on the fixture by hand.
- [ ] 4.5 `hit_ratio_cdf_by_gap_bin`: the CDF of hit ratio per gap bin of `wait_s`, the bins mirrored against the pipeline's `GAP_BINS`; `gap_cdf_by_cause`: the CDF of `wait_s` per `waited_for`; `mean_hit_ratio_by_cause`. Parity: the median hit ratio per bin, the median gap per cause, the mean hit ratio per cause. Verify on the fixture by hand.
- [ ] 4.6 `hit_ratio_cdf_by_transition` replaces `hit_ratio_by_transition`: the CDF of hit ratio after an append and after a mutation. Parity: both medians. Verify on the fixture by hand.
- [ ] 4.7 `retained_over_active`: reusable and dead token-seconds over active token-seconds per TTL, `ttl_only` policy, summed over the selected weeks, drawn as `dead_over_active_by_policy` is. Verify on the fixture that one week's values equal the tallies' ratios.
- [ ] 4.8 Colours: one colour per harness, model, cause and transition across the trends and figures, in `style.css` and `charts.js`. Verify in light and dark mode.

## 5. Words

- [ ] 5.1 About page: the default selection is the paper's population; harness, gap bin and the wait causes defined in the pipeline's words; the list of figures drawn more simply than the paper; links without `figures.html`. Update `tests/test_about_page.py`. Verify every hand-written number against the code.
- [ ] 5.2 `README.md`, `CONTRIBUTING.md` and `CLAUDE.md`: the one page, the file-per-week layout, the answers folder, the streaming, how to add a figure (query, answer, draw function, legend, tests), and that `make data` must follow a query edit. Verify the layout block against `git ls-files`.

## 6. Deploy

- [ ] 6.1 Range-request probe on the host (carried over): publish the data and a one-query page to `gh-pages`, run one narrowed-selection query, and check in the network panel that the Parquet responses are `206` and total well under the file size. Record the bytes in `design.md`. If range reads fail, stop and revisit decision 2.
- [ ] 6.2 Check the deployed site end to end (carried over, with the new default): every page at 360 px and at desktop width, in light and dark mode; the default page is drawn before any DuckDB or Parquet fetch; the stream's total bytes and duration; a one-month selection draws its first figure in under five seconds before the stream and under two after it; the largest session's Requests view opens in under two seconds. Record the measured bytes and times in `design.md`.
