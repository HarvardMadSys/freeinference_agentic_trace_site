# Tasks

Every task ends with `make test` green and one commit. A task that adds a
query also adds it to the query test. A task that adds a view also checks it
in a browser at 360 px and at desktop width, in light and dark mode.

## 1. Repository

- [x] 1.1 Create the layout of `site-repository`:
  - `README.md`: what the site is; `make data`, `make serve`, `make deploy`.
  - `Makefile`.
  - `pyproject.toml`: the pipeline as a path dependency and pyarrow, with
    pytest and duckdb as test extras.
  - `.gitignore`: `site/data/`, `.venv/`.

  Verify `make setup && make test` runs with zero tests and exits 0.
- [x] 1.2 Add `tests/test_repository.py`, which checks that:
  - functions are ≤ 50 lines and modules ≤ 300 lines, in Python and JS;
  - no Python import is aliased;
  - no CDN URL appears outside `site/js/shared/libraries.js`;
  - no `SELECT`/`FROM` text appears in `site/js/`;
  - nothing under `site/data/` is tracked.

  Verify each check fails on a deliberately bad file, then passes.
- [x] 1.3 Write `site/js/shared/libraries.js`, exporting DuckDB-WASM and Observable Plot from jsDelivr at exact versions (the newest release at least two weeks old). Verify a blank page that imports it logs both versions in the browser console.

## 2. Range-request probe

- [ ] 2.1 Write the latest week's requests without `block_ids` to a temporary Parquet file, publish it with a one-query probe page to the `gh-pages` branch, and run `SELECT median(prompt_tokens) FROM requests WHERE week = …`.
  - Verify in the browser's network panel that the Parquet responses are `206 Partial Content` and total well under the file size.
  - Record the bytes fetched in `design.md` §7.
  - If range reads fail, stop and revisit design decision 2 before group 3.

## 3. Site data

- [x] 3.1 Add `tests/fixture_release.py`. It writes a two-week release in the pipeline's layout, with valid `manifest.json` and `tables.json`, and a simulation folder for one week. The release holds seven sessions:
  - one with a subagent that has its own subagent;
  - two subagents whose requests overlap;
  - one SWE-Bench session;
  - one session with a mutation;
  - one user whose idle gap crosses the week boundary.

  Verify `release.reader.load` reads it.
- [x] 3.2 `site_data/requests.py` writes the release's request columns with the role tokens flattened, plus these columns, each from the pipeline's function:
  - `week, scope, is_top_level, root_session_id, depth, turn`;
  - `uncached_tokens, hit_ratio, wait_s`;
  - `idle_gap_s, idle_gap_bin`, with the idle gap computed over all weeks;
  - `is_trusted_ttft, n_tool_calls`.

  Verify against hand-computed values for the fixture's sessions, including `depth` 2.
- [ ] 3.3 `site_data/sessions.py` and `site_data/tool_calls.py` write the columns of `site-data`. Verify that:
  - per-session totals equal the sums of the session's requests;
  - `subagents` counts every depth;
  - `main_model` breaks ties by name;
  - every tool call joins exactly one request.
- [ ] 3.4 `site_data/simulation.py` and `weeks.json`: the tallies with `week` and `active_token_seconds` added, and `{week, last_day, month, simulated}`. Verify the fixture's unsimulated week is marked and a week starting 2026-05-31 has month `2026-05`.
- [ ] 3.5 `site_data/__main__.py`:
  - takes `--release`, `--simulation` and `--out`;
  - sorts by week, root session, session and step;
  - writes with `ROWS_PER_GROUP = 10_000`;
  - stops on a hash mismatch before writing anything;
  - prints each file's rows and size.

  Verify that two runs give identical bytes, that a corrupted fixture table stops the run with the week named, and that each row group's statistics cover a single week's range.
- [ ] 3.6 Run `make data` on the full release and record the run time, each file's size and the largest file in `design.md`. Verify no file exceeds 100 MB.

## 4. Shared browser modules

- [ ] 4.1 `site/js/shared/database.js`: one DuckDB per page, views over the four Parquet URLs, and `runQuery(name)` fetching `queries/<name>.sql`. Verify a test page runs `queries/request_count.sql` and shows the fixture's count.
- [x] 4.2 `site/js/shared/selection.js`:
  - reads and writes `weeks`, `month` and `scope` in the URL, ignoring unknown weeks;
  - fills `selected_weeks` and `selected_scopes`;
  - draws the picker grouped by month, and the scope switch.

  Verify `tests/selection.test.js` (`node --test`) covers parsing, the default, an unknown week, and a month that covers two weeks.
- [x] 4.3 `site/js/shared/table.js`: sort, substring search, filters and pages as plain functions over an array, and a renderer with a row-click callback. Verify `tests/table.test.js` covers sort order, a second click reversing it, the search, combined filters and page boundaries.
- [x] 4.4 `site/js/shared/histogram.js`: the distribution card, drawing bins a query computed on a log or linear scale, with percentile lines, a subtitle and bin tooltips. Verify `tests/histogram.test.js` checks the subtitle text and the bins' conversion from query rows.
- [x] 4.5 `site/js/shared/charts.js` and `site/style.css`:
  - fixed colours per model, category, policy and token part;
  - a CDF helper;
  - loading and error states;
  - light and dark tokens;
  - the shared header.

  Verify the same name gets the same colour across two calls, and the header carries the selection.
- [x] 4.6 `site/about.html`: definitions in the pipeline's words, how the data were built, and links. Verify every term used in the captions of `explore-page`, `figures-page` and `session-page` is defined there.
- [ ] 4.7 `tests/test_queries.py`: build the fixture data, create the three selection tables in Python DuckDB, run every `site/queries/*.sql`, and check each returns its expected columns. Verify it fails on a query that reads a column the data lack.

## 5. Explore page

- [ ] 5.1 `site/index.html` and `js/pages/explore.js` with the weekly trend bars (`sessions_per_week_by_harness.sql`, `input_tokens_per_week.sql`). Verify that a bar click selects one week and changes the URL, and that the layout and picker draw before DuckDB loads.
- [ ] 5.2 Headline numbers and model mix (`headline_numbers.sql`, `model_mix.sql`). Verify on the fixture that the counts equal the release's top-level totals under scope `All`.
- [ ] 5.3 Eight distribution cards (one query each, returning bins and exact percentiles). Verify on the fixture that each card's median equals a hand-computed median.
- [ ] 5.4 Sessions table (`sessions_of_selection.sql`) with search, filters, sort and page in the URL. Verify that a search by an id prefix finds the session, that the filter count shows matching over total, and that a row click opens `session.html?week=…&id=…`.

## 6. Paper figures page

- [ ] 6.1 `site/figures.html` and `js/pages/figures.js` run each section's figures and redraw them on a selection change. Each figure shows its rows, scope and weeks, and hides thin bins with a note. Verify with a stub section of one figure.
- [ ] 6.2 Sessions section: `js/figures/sessions.js` and the seven queries of `figures-page`. Verify each query on the fixture and each chart in the browser.
- [ ] 6.3 Tools section: four queries. Verify the overview table's shares sum to 1 and its percentiles are in order.
- [ ] 6.4 Prefix-caching section: four queries, with the simulation charts captioned "Agentic" under any scope. Verify that one week's simulated hit ratio equals hit over hit plus miss from that week's tallies.
- [ ] 6.5 `tests/test_paper_parity.py`: with all weeks and `Agentic`, run the queries on the full site data and compare every shared number with the paper's `numbers.json`. When the full data are absent, skip with a message. Verify it passes on the full release.

## 7. Session page

- [ ] 7.1 `site/session.html` and `js/pages/session.js` with `session_requests.sql`, `session_tool_calls.sql` and `session_tree.sql`:
  - the stat strip;
  - "not found";
  - a subagent's id opening its top-level session;
  - the `view` and `step` URL parameters.

  Verify on the fixture's nested subagent and on an unknown id.
- [ ] 7.2 `js/session/overlaps.js`: groups of requests whose intervals overlap. Verify `tests/overlaps.test.js` covers touching intervals (not an overlap), nesting, and three-way overlap.
- [ ] 7.3 Requests view (`js/session/requests.js`):
  - bars split into cached, uncached and output;
  - tool-call chips;
  - collapsible subagent groups, with expand all and collapse all;
  - overlap brackets;
  - the details panel on a row click;
  - scrolling to and highlighting `step`.

  Verify on the fixture that expanding the depth-2 subagent and opening a `step` link both work.
- [ ] 7.4 Context view (`js/session/context.js`): cached and uncached area over elapsed time, the switch to roles, one trajectory line per agent, turn and transition marks, and a click opening the request. Verify the fixture's mutation step is marked with its cause.
- [ ] 7.5 Timeline view (`js/session/timeline.js`): one row per agent, request bars split at TTFT, tool bars coloured by category, waits coloured by cause, and a click opening the request. Verify the fixture's overlapping subagents appear on separate rows at overlapping times.

## 8. Deploy

- [ ] 8.1 `make deploy`: copy `site/` to an orphan `gh-pages` commit and force-push it. Verify the branch holds one commit after two deploys.
- [ ] 8.2 Check the deployed site end to end:
  - every page at 360 px and at desktop width, in light and dark mode;
  - Parquet responses are `206`;
  - a one-week Explore load fetches under 10 MB after DuckDB;
  - the largest session's Requests view opens in under two seconds.

  Record the measured bytes and times in `design.md`.
