# Design: simplify

## 0. The gate every task passes
Before the first task, a scratch script (outside the repository) opens
the served site in headless Chromium and saves, for the landing page
with each of the six topics shown and for one session page in its three
views, the outer HTML of every chart's SVG, every table's rows, every
legend's text, and the stats strip, with Plot's generated ids
normalised. After each task the script runs again and the two trees are
compared; the diff must be empty, or every difference named in the
task's report and accepted by its reviewer. `make test` stays green at
every commit. A reviewer reads each task's diff against this design and
the rules in CONTRIBUTING.md, and a final whole-branch review closes.

## 1. The browser query path (JavaScript)
What the switch guards is never reached: `openDatabase` is opened
answers-only, `setSelection` is a no-op, the stream returns at once, the
pickers are never mounted, the observer is never made. Removed:
- `js/engine/` (three modules), `loadDuckDB` in `shared/libraries.js`.
- `explore/selection_pickers.js`; `note` and `controlsRow`, which the
  sessions table uses, move into `sessions_table.js`.
- `shared/database.js` becomes `fetchWeeks`, `fetchHarnesses` and
  `runQuery(name)` reading `data/all_weeks/<name>.json`; the `Database`
  class, `openDatabase`, the selection fill and the statement cache go.
  `context.database` becomes the imported `runQuery`.
- `shared/selection.js` keeps `selectionQuery`, `namesIn` and
  `EVERY_WEEK_VALUE`, which move to where they are used (`layout.js`
  and `sessions_filter.js`); the rest goes.
- `explore/start.js`: the switch, `openPage`'s selection and database,
  `streamedWeeks`, `showSelectionAndHeader`, `latestRun`, the no-week
  and no-harness notes, `changeSelection`, `selectWeek`, `mountPicker`,
  `showStreamed`, `onWeekClick`, `filterInTable`. One run per page.
- `explore/figure_sections.js`: the observer branch, `IN_VIEW_MARGIN`,
  `showNoteInFigures`, `runDrawsAtOnce`, `noteVisibility`,
  `noteCardsInView`, the `drawsAtOnce` and `visibleNames` arguments. The
  started set stays for the tabs.
- `explore/sessions_table.js` and `sessions_table_state.js`: the
  `filter === null` branches, `selectedHarnessField`, the
  `writeSelection` branch, `rowsOfHarnesses`, the dead `harness` state.
- `explore/trends.js`: the clickable-bar branches, opacities and hint;
  `drawBars` loses `fillOpacity`.
- `landing/stats.js` reads `context.weeks`.
- `index.html`'s `#selection` section and its CSS (`.control-group`,
  `.pill*`, `.text-button`, `.pill-mark`, `.selection`).
- Tests: `duckdb_files`, `explore_selection_pickers` whole; the dormant
  parts of `selection`, `database`, `explore_figure_sections`,
  `explore_trends`, `explore_sessions_table`, `landing_stats`; in
  `test_queries.py` the mirror of `duckdb_views.js`; `test_repository.py`'s
  engine check.
- The `queries/setup/` statements stay: `make data` runs them.

## 2. The row files and the build (Python)
`site_data/__main__.py` builds the four frames as today and registers
them with DuckDB (`connection.register("requests", frame)`) instead of
writing Parquet and reading it back through views. Removed:
`site_database.py`'s `FILES_PLACEHOLDER`, `VIEW_STATEMENTS`,
`week_files`, `quoted_list`; the four `setup/create_view_*.sql`;
`write_kind`, `write_week_file`, `WrittenKind`, `ROWS_PER_GROUP`,
`COMPRESSION`, `SORT_ORDERS`; `paths.WEEK_FOLDER_PREFIX`, `ROWS_FILE`,
`week_file`; `weeks.weeks_with_file`; the no-simulated-week special case
(`rows_unless_simulation_is_missing`, `WrittenAnswers.unanswered`,
`any_simulated`), since an empty frame with the right columns registers
fine; the partial-folder rename; one `JSON_SEPARATORS`, one
run-and-collect helper. The selection tables and `benchmark_harness`
stay: `make data` still varies the selection. `site/data/{requests,
tool_calls,sessions,simulation}/` are deleted from the tree.

Also dropped, since this reruns `make data` anyway: the queries no page
reads (`explore/request_count`, `explore/headline_numbers`) with their
tests, `trace_totals` becoming CONTRIBUTING's example; the frame columns
no query reads (`requests.idle_gap_s`, `simulation.active_token_seconds`);
the bucket columns no view reads (`n_tool_calls`, `main_model`,
`user_id`, `call_index` in the SELECT). The figure queries
`ttft_median_by_model` and `decode_median_by_model` stay: parity reads
them.

The parity tests read `site/data/all_weeks/<query>.json` into a frame
instead of running the query live; the `selected_database` and scope
fixtures go; `test_the_benchmark_s_medians` is kept once; the headline
test compares `trace_totals`, which gains `output_tokens` and
`cached_tokens` columns (the strip does not show them).

Before the row files are deleted, the answers are rebuilt from frames
and compared with the shipped ones; a difference must be a float's last
bits (under 1e-9 relative), recorded in the task's report.

## 3. One caller, one form (JavaScript)
- Draw and legend wrappers that forward one constant become arrows in
  the entry (`scope_cdfs.js`, `tools.js`, `sessions_ranked.js`,
  `sessions.js`, `tokens.js`, `caching_gaps.js`, `tools_batching.js`,
  `tool_mix.js`); `scopeLegend` and `modelCdfLegend` stay functions.
  `hidden` is passed to every draw; the arity check and its test go.
- Folded: `session_requests/request_legend.js` into `requests.js`;
  `session_charts/timeline_pointer.js` (with `scrollBox`) into
  `timeline.js`; `session/overlaps.js` into `request_brackets.js`;
  `viewChartWidth` into `chartFrame(body).width`.
- Once: the five input roles (`INPUT_ROLES` in `session/token_parts.js`),
  `topLevelSession(tree)` in `tree.js`, `groupedBy` and `byStart` reused,
  the halo style (`LINE_LABEL_STYLE`), one percent tick, the violet slot
  as a named constant, `SPEEDUP_COLOURS` as `TIME_PART_COLOURS`,
  `setOrDelete`, `figureDrawnRows` inlined, one drawn-rows filter for
  models and providers, `formatTokens` as `formatCompactCount`,
  `modelText` dropped (`nameText` optional), `causeColours` inlined,
  `TOOL_CATEGORY_COLOURS` derived from `TOOL_GROUP_OF_CATEGORY`.
- Dropped: `isPartlySimulated` (one flag), `seriesOverSameRows` on the
  ranked figures, `drawBars`'s `stacked`, `order` and `fillOpacity`,
  `isWait` on timeline bars, `DEFAULT_COUNT_LABEL`, `p75`/`p90` on the
  histogram card, the `Number()` casts, histogram's `BAR_INSET`,
  `maxTicksFor`, `durationTicks`'s unused parameter, `mountLegend`'s
  always-empty `hidden`, `renderPageHeader`'s unused argument, the
  double `renderFooter`, the bucket URL's trailing-slash branch, the
  section `layout` hook (`runStats` shows loading itself), `mountTable`'s
  optional callbacks and the `{ key, equals | atLeast }` filter objects
  (a plain loop in `shownSessions`), `TIP_STYLE` (the `--plot-background`
  rule does it; dark mode checked).
- Session page: one `showOnly(view, address)` replaces `shownView` and
  the repeated tab marking.
- Kept on purpose: the two week tick formats (merging would move a
  label), the legend's and the tabs' separate key handling (they differ),
  the same-prefix bucket shortcut, the defensive one-line fallbacks the
  release format allows, every session-page feature (each occurs in the
  data: overlaps in 353 sessions, missing TTFT in 347 requests, depth 4
  trees, 2,543 model switches).

## 4. Tests that test behaviour
Removed: `test_differences.py`'s sentence matching (the figure-definition
test stays); `landing_stats.test.js`'s duplicate of `test_answers.py`;
the four-fold "no cache report" tests but the home one; the re-tests of
`dropThinGroups` and `restingCountText`; the flag-value assertions; the
fetch-count and no-slash tests in `session_bucket.test.js`;
`figure_sections.test.js`'s markup regex reduced to ids, numbers and
headings; the `check_answers` CLI tests; the doc-equality test in
`test_pipeline_mirrors.py`.

## 5. Docs and tooling
- README: one folder map (CONTRIBUTING keeps the rules and patterns,
  README the map), no measured timings (they go stale), the bucket
  format in one place (the site-data spec; README and CONTRIBUTING
  point there), `docs/differences.md` folded into "Where the numbers
  come from", the dormant-path and range-request prose gone,
  `package.json` listed once.
- CONTRIBUTING: the restating queries listed once, here; the dormant
  prose gone; the `draw` paragraph shorter.
- CLAUDE.md: the pointer and the git rules.
- `make serve` runs `python3 -m http.server -d site -b 127.0.0.1 8000`;
  `serve.py` and `test_serve.py` go. `check_answers.py`, its Makefile
  target and `make deploy`'s dependency go; `npm run dev` goes.
- The deploy workflow's check asks for `/`, `/data/weeks.json` and the
  newest week's `session_buckets/<week>/index.json.gz`.

## 6. The specs
After this change is archived, by hand in one commit: the five spec
files become three, `site` (repository, data, deployment, look),
`explore-page` and `session-page`, each requirement moved verbatim,
`week-selection`'s one live requirement folded into the sessions table,
the rules that restate CONTRIBUTING dropped, the drift fixed (the
site-data purpose, "reads its week's files whole", the headline
scenario, "unticks one month", the About page in a title).
`openspec/changes/archive/` is deleted: git history holds every change.
`openspec validate --specs --strict` passes.

## 7. What is not done
No rewrite of git history: the 83 MB of Parquet already pushed stays in
the pack. No behaviour change, however small, without a line in this
design.
