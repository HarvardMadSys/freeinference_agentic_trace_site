# Contributing

This site will be read, run and maintained by people who did not write it. A
reader must be able to follow any module on a first read. The rules below are
binding, and `make test` checks the countable ones.

## The rules

- **Simple before fast.** Write the plainest correct code. Cache, precompute,
  split a file or add an index only after a measured run shows the plain
  version is too slow, and record the measurement in the change's
  `design.md`.
- **Plain over clever.** No nested comprehensions, no lambdas or arrow
  functions longer than one expression, no state set on objects the code does
  not own, no side effects at import.
- **Names are words.** `requests`, `sessions`, `weeks`, `selectedWeeks`.
  A one-letter name is only a loop index. Python modules are imported by name
  without aliases; JavaScript uses named imports.
- **One job per unit.** A function is at most 50 lines, a module at most 300.
  A function that computes two things is split.
- **Docstrings state definitions; comments explain why.** Every exported
  function has a one-line docstring (Python) or JSDoc line (JavaScript) that
  says what it returns. A constant that is a decision gets a name and a
  one-line comment saying what it decides. Neither refers to history, people
  or paper figure numbers.
- **SQL is a literal.** Every query is one `.sql` file under `site/queries/`.
  No SQL is written in JavaScript, and no query is assembled from strings. A
  query reads the selection from the selection tables and from nothing else:
  - `selected_weeks(week)`: the selected weeks' Sundays;
  - `selected_harnesses(harness)`: the selected harnesses;
  - `selected_session(week, root_session_id)`: on the Session page, the
    session shown and its week;
  - `benchmark_harness(harness)`: not a choice but a fact, filled from
    `harnesses.json` when the database opens: the harness that is not the
    paper's population.

  A setup statement that fills a table takes its row as `?` parameters
  (`setup/insert_*.sql`). One query takes a parameter: `session/session_root.sql`,
  run through `runQueryWith` with the session id from the URL as its one `?`:
  it finds the session's week and top-level session, which `selected_session`
  is then filled with. Every other query takes none. The view statements
  `setup/create_view_*.sql` hold the placeholder `{files}`, which the opener
  replaces with the names of that kind's week files, each single-quoted and
  separated by commas (`engine/duckdb_files.js` in the browser,
  `site_data/site_database.py` in Python): HTTP has no directory listing, and
  a file registered under its name is what the stream can swap for its bytes.
- **Every definition comes from the pipeline.** Where a query restates one
  in SQL (the cost share's prices, the rank bins, the wait classes), a mirror
  test ties each copied constant to the pipeline's and a parity test ties the
  number to the paper's. Two queries do: `figures/cost_share_by_session.sql`
  (the prices and the rank bins) and `figures/session_time_by_part.sql` (the
  rank bins and which waits are tool time and which a person's), checked by
  `tests/test_pipeline_mirrors.py` and `tests/test_paper_parity_sessions.py`.
  Otherwise the browser filters, groups, counts, sums and takes quantiles. It
  never decides what a turn, a wait or a cache hit is; `site_data` computes
  those by calling the pipeline's functions.
- **No framework, no bundler, no npm dependency.** Plain HTML, CSS and ES
  modules. Libraries come from a CDN at exact versions, named only in
  `site/js/shared/libraries.js`.
- **Only what is needed.** Add a module, a column, a token or a dependency
  when a task needs it, not before.

## How the site is put together

```
page (html)  →  js/pages/<page>.js  →  section modules and js/shared/  →  queries/<page>/<name>.sql  →  site/data/*.parquet
```

```
js/pages/             one module per page
js/shared/            what every page uses: the database, the selection, formatting, charts, the table, the stat strip
js/theme/             the site's colours as the style tokens give them
js/engine/            DuckDB in the page: starting it, its views and setup, the weeks' files and their streaming in
js/explore/           the Explore page's sections, the figure runner (figure_sections.js) and the legend of buttons
js/figures/           the Explore page's figures: one module per section, listing its figure entries, the modules a
                      section takes entries from, and the row rules every figure shares (figure_rows.js)
js/session/           the Session page's address, agent tree, facts, legends, overlap grouping and chart frame
js/session_requests/  the Session page's Requests view
js/session_charts/    the Session page's Context and Timeline views
```

A folder holds one purpose and at most nine modules; `make test` counts them.

- An HTML file is a shell: a header, titled sections with ids, a footer, and
  one `<script type="module">`. It holds no data and no inline script.
- The page module mounts the header and footer, reads the selection from the
  URL, opens the database, and fills each section.
- `shared/database.js` fetches `weeks.json` and `harnesses.json` and runs a
  query by name: `runQuery("explore/request_count")` fetches
  `queries/explore/request_count.sql`. While the selection is the default, an
  Explore or figure query is answered from its file under `data/all_weeks/`
  instead, as is a colour order (`setup/*_order`) whatever the selection.
  DuckDB loads the first time a query needs it (`engine/duckdb_views.js`):
  it registers each week's Parquet files as the views `requests`,
  `tool_calls`, `sessions` and `simulation`, fills `benchmark_harness`, and
  the database fills the selection tables before a query whenever the
  selection has changed. Once a page has drawn its first view it calls
  `streamRows`, which fetches each week's files and hands DuckDB their
  bytes in place of their URLs (`engine/duckdb_files.js`). To turn the
  stream off, set the constant `STREAM_ROWS_AFTER_DRAW` in `database.js` to
  `false`: the default view is unchanged, nothing is fetched until a
  selection is narrowed, and a narrowed selection reads HTTP ranges.
- `shared/selection.js` owns the selection and the URL keys `weeks`, `month`
  and `harnesses` that hold it (none for the default: every week and the
  paper's harnesses); `explore/selection_pickers.js` draws the week and
  harness pickers and calls the page back with each new selection; the page
  fills the selection tables with it.
- A figure is a figure entry (below), listed in its section's module under
  `js/figures/`.

## Patterns to copy

**A query** (`site/queries/explore/request_count.sql`):

```sql
-- The number of requests of the top-level sessions in the selected weeks and harnesses. No page runs it: it is the
-- example query of CONTRIBUTING.md, and tests/test_queries.py checks the count against the fixture.
SELECT count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
```

The first line says what one row is. Columns are named in words. Every
query is run by `tests/test_queries.py` against the fixture data.
`make data` also runs every query under `explore/` and `figures/` once for the
default selection, and the colour orders `setup/*_order`, and writes each
answer to `site/data/all_weeks/`. **Rerun `make data` after editing one of
those queries**: the default view reads the answer, not the query.
`tests/test_answers.py` checks each answer written for the fixture against its
query run live; `make deploy` first runs `make check-answers`, which refuses
when a query's text is not the one `make data` recorded in
`all_weeks/queries.json`.

**A pure JavaScript module with its test** (`site/js/shared/format.js`,
`tests/format.test.js`): exported functions with one-line JSDoc, module-level
constants with a comment, helpers below the exports, and a `node --test` file
with one `test()` per behaviour.

**A Python module with its test** (`site_data/weeks.py`, `tests/test_weeks.py`):
a module docstring stating the definition, a frozen dataclass for anything
that crosses a boundary, and functions that each do one job.

**A figure entry** (listed in `js/figures/<section>.js`'s `FIGURES`). Every
figure of the Explore page is one frozen object with these fields; the
page draws its card, runs its query, hides its thin bins, writes its caption
and calls `draw`:

- `name`: the figure's id, also the id of its card on the page.
- `title`: the card's heading.
- `definition`: one sentence saying what is drawn, and where the site draws
  more simply than the paper, how.
- `query`: the query it draws, as `runQuery` names it (`"figures/<name>"`).
- `binColumn`: the column naming the bin or series each row belongs to, every
  row of a bin carrying the bin's count in `rows`; a bin under
  `MIN_ROWS_PER_BIN` is hidden whole. `null` when every row is a bin of its own.
- `seriesOverSameRows` (optional): true when every series is drawn from the
  same rows, so the caption counts them once rather than summing the series.
- `seriesNouns` (optional): when the series count different things, each
  series' name with the plural noun of what it counts; the caption then gives
  each count ("84,239 turns · 12,002 sessions").
- `isSimulation` (optional): true for a figure of the cache simulation, which
  covers the paper's harnesses and the simulated weeks only; the caption says so.
- `legend` (a figure of more than one series): `legend(rows, colours, seriesColumn)`
  returns the series its legend lists and their colours, `{ series, colours }`,
  each series `{ name, label }`. The page draws the legend as buttons that
  hide and show a series (`explore/legend.js`), redrawing the chart from the
  rows it already has.
- `drawnRows` (optional): `drawnRows(rows, colours)` returns the rows of the
  query the figure draws, when it draws fewer: a line or CDF per provider or
  model draws only those with one of the eight series colours, never one in
  the Other grey. The caption counts these rows, and thin bins are hidden
  among them.
- `seriesColumn` (a figure whose rows each name their series): that column. A
  hidden series' rows are left out before `draw` is called. A figure with a
  `legend` and no `seriesColumn` holds its series in columns, and is given the
  hidden series as a fourth argument instead.
- `draw(rows, body, colours, hidden)`: draws the rows left after thin bins are
  hidden into `body`; `colours` holds the model, category and provider colours every
  figure shares (`{ models, categories, providers }`, each a Map from name to colour),
  and, for a figure with a `legend`, its legend's colours as `series`, which
  the chart colours its series by; `hidden`, the Set of hidden series' names,
  is given only to a figure with a `legend` and no `seriesColumn`.

```js
Object.freeze({
  name: "tokens_per_request_cdf",
  title: "Tokens per request",
  definition: "CDF over requests of input, uncached input and output tokens.",
  query: "figures/tokens_per_request_cdf",
  binColumn: "series",
  seriesOverSameRows: true,
  draw: drawTokensPerRequest,
}),
```

**Adding a figure.** One query, one answer, one draw function, and their
tests:

1. **The query**, `site/queries/figures/<name>.sql`, as above: the selection
   from the selection tables; where thin bins are to be hidden, a column
   naming each row's bin or series and that bin's count in `rows`. List its
   columns in `EXPECTED_COLUMNS` of `tests/test_queries.py`, and test its
   numbers on the fixture, counted by hand, in its section's query test
   (`test_figure_queries.py`, `test_session_figure_queries.py` or
   `test_caching_queries.py`).
2. **The answer.** Run `make data`, which writes
   `site/data/all_weeks/figures/<name>.json`. `tests/test_answers.py` already
   runs every figure query live on the fixture and compares it with the
   answer written for it, and fails on a query with no rows there, so the
   fixture must hold a case of the figure.
3. **The draw function and the entry**, in the section's module under
   `js/figures/` or a module it takes entries from: a frozen figure entry, and
   a draw function that loads Plot where it needs it and colours its series
   from `colours`. Its pure parts (rows to series, bars or stacks) are
   exported and tested with `node --test`. Add its name to the section's list
   in `tests/figure_sections.test.js`.
4. **The legend**, for a figure of more than one series: `legend(rows,
   colours, seriesColumn)` (`seriesLegend` in `figures/figure_rows.js` builds one from rows
   that name their series), and either `seriesColumn` or a `draw` that takes
   `hidden`; list the figure under `LONG_FORMAT_SERIES_COLUMNS` or
   `WIDE_FORMAT_FIGURES` in `tests/figure_sections.test.js`. A series that is a
   model, category, cause, transition or gap bin takes that thing's colour.
5. **Parity**, when the paper's `numbers.json` holds a number the figure
   shows: compare it in `tests/test_paper_parity*.py`, which runs the query
   on the full data with the default selection.
6. **A mirror test**, when the query or a module copies a pipeline constant
   (a bin edge, a price, a list of causes): a test in
   `tests/test_pipeline_mirrors*.py` that parses the copy and compares it with
   the pipeline's own.
7. **The words.** Where the figure is drawn more simply than the paper, its
   definition says how, and so does the About page's list;
   `tests/test_about_page.py` counts the figures the About page states.

## JavaScript style

- ES modules only. `import { thing } from "./module.js"`, with the `.js`
  extension; namespace imports only for a library in `libraries.js`.
- Nothing outside `libraries.js` imports it statically: node cannot load
  the CDN's `https://` modules, so a module that did would be untestable.
  A function that draws or opens the database loads what it needs where it
  needs it, `const { Plot } = await import("./libraries.js");`, with a
  one-line comment saying why. The module's pure functions then stay
  testable with `node --test`.
- Static markup is an `innerHTML` template; interactive elements are built
  with `document.createElement` so listeners attach to the element, not to a
  string. Text that comes from data goes through `textContent` or a template
  the data cannot break.
- One `mount<Thing>(container, ...)` function per component: it draws and
  wires listeners. State lives in the URL or in the arguments; no module
  keeps mutable state beyond what the page owns.
- Loading and error states come from `shared/charts.js`: a section shows
  `loading` until its query returns and `is-error` with the message if it
  throws. One failed query never stops the others.
- Numbers go through `shared/format.js`.

## Charts

Charts are drawn with Observable Plot, except the Session page's bar list,
which is plain HTML.

- **Colour.** Series colours are the tokens `--series-1` to `--series-8` in
  `style.css`, assigned in that order to a chart's series and never cycled;
  a ninth series folds into "Other" (`--series-other`). A request's cached,
  uncached and output tokens are always `--token-cached`, `--token-uncached`
  and `--token-output`. The same model, category, policy or wait cause has the
  same colour in every chart: a wait cause, a transition and a gap bin always
  take `--cause-*`, `--transition-*` and `--gap-bin-1` to `--gap-bin-6`, read
  through `CAUSE_COLOURS`, `TRANSITION_COLOURS` and `GAP_BIN_SLOTS` in
  `theme/colours.js`. The palette was validated for colour-vision
  deficiency in both modes; three light-mode slots sit under 3:1 contrast on
  white, so every chart ships a legend and a hover tooltip, and tables stay
  available where values matter.
- **Marks.** Thin lines (2px), small markers, a 2px gap between stacked
  segments, grid and axes in `--chart-grid` and `--chart-axis`, labels in
  `--chart-label`. Text is never coloured by series.
- **One axis.** Two measures of different scale are two charts.
- **Captions.** A figure shows its title, a one-sentence definition, the
  number of rows it rests on, and the harnesses and weeks it shows. Where the
  site draws more simply than the paper, the definition says so.

## Verifying a change

```bash
make test
make serve     # then open http://localhost:8000
```

Before committing anything that touches a page: open it at 360 px wide and
at desktop width, in light and dark mode; check the console is clean; check
that the selection survives a reload and a link to another page. `make
setup-browser` installs a headless Chromium; a short Playwright script from
the virtual environment (`.venv/bin/python`) can open `http://localhost:8000`,
collect the console and take the screenshots.

One task per commit, `make test` green at every commit. Commit messages say
what changed and why in one line, and end with the attribution line the
repository's `CLAUDE.md` gives.
