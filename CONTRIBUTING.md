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
- **Names are words.** `requests`, `sessions`, `weeks`, `toolCalls`.
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
  - `selected_weeks(week)`: the selected weeks' Sundays; `make data` fills
    it with every week for the answers, and with one week at a time for the
    bucket queries;
  - `selected_harnesses(harness)`: the selected harnesses; `make data` fills
    it with the paper's harnesses for the figures and with every harness for
    the Explore page's own answers (`EVERY_HARNESS_QUERIES` in
    `site_data/answers.py`: the Overview's mixes and trends, the session
    list, its first page and the trace totals);
  - `benchmark_harness(harness)`: not a choice but a fact, filled from the
    harness index when the database opens: the harness that is not the
    paper's population.

  A setup statement that fills a table takes its row as `?` parameters
  (`setup/insert_*.sql`); no query takes one. The tables `requests`,
  `tool_calls`, `sessions` and `simulation` are the data step's frames of
  rows, held in memory
  (`site_data/site_database.py`). One view reads the selection:
  `setup/create_view_session_time.sql`, each selected top-level session's
  time in prefill, decode, tool and user idle, made after the selection
  tables; both figures of a session's time read it, so the breakdown has one
  home.
- **Every definition comes from the pipeline.** Where a query restates one
  in SQL (the cost share's prices, the rank bins, the wait classes, what a
  tool wait is and how long it counts for, the tool groups, the cache
  simulation's TTLs and costs, the mutation table), a mirror test ties each
  copied constant to the pipeline's and a parity test ties the number to the
  paper's. Ten queries do: `figures/cost_share_by_session.sql` (the prices
  and the rank bins), `figures/session_time_by_part.sql` (the rank bins) and
  `figures/speedup_if_twice_as_fast.sql`, both reading the view
  `setup/create_view_session_time.sql` (which waits are tool time and which
  a person's, and the tool wait cap), checked by `tests/test_pipeline_mirrors.py` and
  `tests/test_paper_parity_sessions.py`;
  `figures/calls_per_request_by_category.sql` (the Ask User category) and
  `figures/latency_by_batch_width.sql` (what a tool wait is, the Ask User
  category, the widest width and the quantiles), checked by
  `tests/test_pipeline_mirrors.py` and `tests/test_paper_parity.py`;
  `figures/tool_mix_by_turn_position.sql` (the tenths, each category's tool group and the programs that decide a
  `*File Ops` call's), checked by `tests/test_pipeline_mirrors.py` and
  `tests/test_paper_parity_comparison.py`;
  `figures/prefill_against_storage.sql` (the TTLs),
  `figures/api_cost_by_ttl.sql` and `figures/infrastructure_cost_by_ttl.sql`
  (the TTLs, the prices, the normalising TTL, the knee and the lowest-cost
  rules) and `figures/mutations_by_cause.sql` (the table's rows and which
  sessions count as appends), checked by `tests/test_pipeline_mirrors_caching.py`
  and `tests/test_paper_parity_caching.py`. README and `CLAUDE.md` point
  here; `RESTATING_QUERIES` in `tests/test_pipeline_mirrors.py` is the copy
  the tests read, and a new restating query is added to both. Otherwise a query filters, groups,
  counts, sums and takes quantiles, and neither a query nor the browser
  decides what a turn, a wait or a cache hit is; `site_data` computes those
  by calling the pipeline's functions.
- **No framework, no bundler, no npm dependency.** Plain HTML, CSS and ES
  modules. Libraries come from a CDN at exact versions, named only in
  `site/js/shared/libraries.js`.
- **Only what is needed.** Add a module, a column, a token or a dependency
  when a task needs it, not before.

## How the site is put together

```
make data:     queries/explore/, queries/figures/, setup/*_order  →  run over the rows in memory  →  data/all_weeks/<page>/<query>.json
               queries/buckets/, one week at a time                →  run over the rows in memory  →  data/session_buckets/<week>/<xx>.json.gz
Explore:       index.html  →  js/pages/explore.js  →  js/explore/start.js, section modules and js/shared/  →  data/all_weeks/<page>/<query>.json
Session:       session.html  →  js/pages/session.js  →  js/session/bucket.js  →  data/session_buckets/<week>/<xx>.json.gz
```

README's Layout maps every folder and module. A folder holds one purpose and
at most nine modules; `make test` counts them.

- An HTML file is a shell: a header, titled sections with ids, a footer, and
  one `<script type="module">`. It holds no data and no inline script.
- The page module mounts the header and footer, reads what it shows from the
  URL, fetches its answers (the Explore page, through `explore/start.js`) or
  its session's bucket (the Session page), and fills each section.
- The site has two pages. The Explore page, `index.html` and
  `js/pages/explore.js`, is the landing page and holds, in order, the hero
  and stats strip, the Overview (`#overview`), the Session Explorer
  (`#sessions`), the Insights (`#insights`), Cite (`#cite`) and Team. Its
  module lists its sections in `SECTIONS` and calls `startPage` of
  `explore/start.js` with them; `startPage` draws the footer and mounts the
  Insights' tabs and figure cards (`FIGURE_SECTIONS` of
  `explore/figure_sections.js`), fetches the indexes, draws the header and
  runs the sections. The header links the page's
  sections by anchor (`LINKED_SECTIONS` of `shared/layout.js`, beside
  `EXPLORE_FILE`, the page's one file name); on a phone it is two rows, the
  brand and the four links, which wrap, and the page measures its height
  for the sections' scroll margin. From the Session page the links lead to
  `index.html` with the URL's keys, which are the table's. Pages link one
  another by their `.html` names; the host serves each at its clean path
  with the query kept.
- `shared/database.js` fetches `weeks.json` and `harnesses.json` and reads a
  query's answer by name: `runQuery("explore/trace_totals")` reads
  `data/all_weeks/explore/trace_totals.json`, which `make data` wrote by
  running `queries/explore/trace_totals.sql`. Every Explore and figure
  query, and every colour order (`setup/*_order`), has its answer file; the
  page runs no query itself.
- The Session page imports nothing from `shared/database.js`, and
  `tests/test_repository.py` checks it; how it reads a session is below.
- The URL keys `months` and `harnesses` belong
  to the session list: `explore/sessions_filter.js` reads them (and the
  older `weeks`, `month`, `scope` and `harness`), filters the list's answer,
  which holds every harness's sessions, and writes them back; they reach
  nothing else.
- A figure is a figure entry (below), listed in its section's module, in the
  page's order: `js/figures/sessions.js` (Session structure), `tokens.js` (Tokens and
  cost), `latency.js` (Latency), `tools.js` (Tools), `caching.js` (Prefix
  caching) and `js/comparison/comparison.js` (Human-driven against
  benchmark), each taking entries from the modules beside it, from
  `js/simulation/` or from `js/comparison/`. Each section module also
  exports `TAKEAWAY`, its topic's finding in one sentence of at most twenty
  words, which the page writes under the topic's heading.
  `explore/figure_sections.js` lists the six in `FIGURE_SECTIONS`, and
  `index.html` holds, under the Insights heading and its `#topic-tabs` row,
  a section with a heading and a card grid for each, its id the topic's
  anchor (`#insights-sessions`, `#insights-tokens`, `#insights-latency`,
  `#insights-tools`, `#insights-caching`, `#insights-comparison`).
- The topics are tabs (`explore/topic_tabs.js`), following the ARIA tabs
  pattern (one tab stop, the arrow keys, Home and End, each topic a tab
  panel): one is shown and the others hidden, the shown one named by the
  URL's hash and kept in the history entry's state; a tab chosen pushes a
  new entry with its topic, so Back returns to the topic before, whatever
  anchor the page opened on. A
  chart reads its width from its card, and a hidden card has none, so
  `figure_sections.js` starts only a shown topic's figures, and showing a
  topic runs the same start step a card coming into view does. Nothing is
  drawn into a hidden topic.

**Adding a section to the Explore page.** Give it a place in the page's HTML,
an element with an id, under a heading if it is a part of its own; write its
module with `async run<Thing>(container, context)`, which shows the loading
state in the container at once and then draws its answer into it (`context` is
described in `explore/start.js`); and add `{ id, run }` to the page module's
`SECTIONS`. The answer of sessions per week by harness, which the harness
mix and the sessions trend both draw, is asked for once a run and given as
`context.sessionsPerWeekByHarness`. A new topic of figures is a section module of figure
entries instead, added to `FIGURE_SECTIONS` and to `index.html`'s
Insights, where it becomes a tab.

## How a session is served

The Session page runs no query. `make data` (`site_data/buckets.py`)
selects one week at a time and runs the three bucket queries,
`queries/buckets/week_tree.sql` (the facts card's and the agent tree's
columns), `week_requests.sql` and `week_tool_calls.sql`, each returning
`root_session_id` first and ordered by it, and writes the week's buckets and
its index of session ids. The format, and why a rebuild of the same rows
writes the same bytes, are defined in `site_data/buckets.py`'s docstring.

`js/session/bucket.js` reads them: `fetchSession(dataUrl, week, id)` fetches
the bucket the id's first two characters name, gunzips it in the browser
with `DecompressionStream` unless the host already removed the gzip layer,
and returns the id's entry as `{ tree, requests, toolCalls }`, each
a list of row objects from column name to value, which the facts card, the
tree and the three views take. An id the bucket does not hold is looked up
in the week's index, and its top-level session's bucket fetched; an id in
neither gives null, which the page shows as "session not found in this
week". The tool categories' colours come from the shipped
`setup/category_order` answer.

**Adding a column to the Session page.** Add it to the bucket query that
holds its kind of row, under `site/queries/buckets/`, in the place the
views should find it, and to that query's list in `EXPECTED_COLUMNS` of
`tests/test_queries.py`; read it by name from the row objects in the view
that shows it, with a test of the view's pure function. Then run `make data
PIPELINE=<the pipeline's checkout>` and commit `site/data` with the change:
a new column rewrites every bucket, nearly the whole data folder in the
repository's history, so gather columns into one change.
`tests/test_buckets.py` checks a bucket's rows against its queries' on the
fixture.

## Patterns to copy

**A query** (`site/queries/explore/trace_totals.sql`):

```sql
-- One row: the trace in the selected weeks and harnesses as the paper's summary table counts it; the data step answers
-- it with every week and every harness, the benchmark's too, so it counts the whole trace, as the session list lists it.
-- A top-level session is one no other session spawned, so it has no parent; its requests, tokens and tool calls are
-- its own, a subagent's counted in neither. `benchmark_harnesses` counts the harnesses that are the benchmark's,
-- which the stats strip writes apart from the others ("13 (+1)"). The strip does not show `output_tokens` and
-- `cached_tokens`; tests/test_paper_parity.py compares them, with the rest, with the paper's summary.
SELECT count(*) AS sessions,
       coalesce(sum(requests), 0) AS requests,
       coalesce(sum(input_tokens), 0) AS input_tokens,
       coalesce(sum(output_tokens), 0) AS output_tokens,
       coalesce(sum(cached_tokens), 0) AS cached_tokens,
       coalesce(sum(tool_calls), 0) AS tool_calls,
       count(DISTINCT harness) AS harnesses,
       count(DISTINCT harness) FILTER (WHERE harness IN (SELECT harness FROM benchmark_harness)) AS benchmark_harnesses
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
```

The first line says what one row is. Columns are named in words. Every
query is run by `tests/test_queries.py` against the fixture data.
**Rerun `make data` after editing a query under `explore/`, `figures/` or
`buckets/`, or a colour order**: the pages read the answers, not the
queries. `tests/test_answers.py` checks each answer written for the fixture
against its query run live, and that the shipped answers come from each
query's current text: `make data` records the hash of each query in
`all_weeks/queries.json`, and a query edited since fails `make test` until
`make data` runs again.

**A pure JavaScript module with its test** (`site/js/shared/format.js`,
`tests/format.test.js`): exported functions with one-line JSDoc, module-level
constants with a comment, helpers below the exports, and a `node --test` file
with one `test()` per behaviour.

**A Python module with its test** (`site_data/weeks.py`, `tests/test_weeks.py`):
a module docstring stating the definition, a frozen dataclass for anything
that crosses a boundary, and functions that each do one job.

**A figure entry** (listed in its section module's `FIGURES`). Every
figure of the Insights is one frozen object with these fields; the
page draws its card (title, insight, legend, chart, caption, and a Definition
control that opens on the definition and the line of rows), reads its query's
answer, hides its thin bins, writes its line of rows and calls `draw`:

- `name`: the figure's id, also the id of its card on the page.
- `title`: the card's heading.
- `insight`: the card's point, under its title: one sentence of at most
  twenty words saying what the chart means, not what it draws ("Sessions are
  mostly idle time between turns."); a number appears only where the number
  is the point. The sentences are the paper's claims, and no test checks one
  against the data.
- `caption`: evidence supporting the insight, shown under the chart in up
  to three short sentences and at most forty words total; use measurements,
  comparisons or trends from the paper, with relevant qualifications.
- `definition`: up to three short sentences, at most sixty words in total,
  explaining what is drawn in plain words ("percentage of requests at or
  below each …", not "CDF"); spell out price units and explain technical
  terms where they are used instead of packing clauses into one sentence;
  where the site draws more simply than the paper, README's "Where the
  numbers come from" says how, not the definition; shown behind the
  Definition control.
- `query`: the query whose answer it draws, as `runQuery` names it
  (`"figures/<name>"`).
- `binColumn`: the column naming the bin or series each row belongs to, every
  row of a bin carrying the bin's count in `rows`; a bin under
  `MIN_ROWS_PER_BIN` is hidden whole. `null` when every row is a bin of its own.
- `seriesOverSameRows` (optional): true when every series is drawn from the
  same rows, so the line of rows counts them once rather than summing them.
- `seriesNouns` (optional): when the series count different things, each
  series' name with the plural noun of what it counts; the line of rows then
  gives each count ("84,239 turns · 12,002 sessions").
- `isSimulation` (optional): true for a figure that reads the cache
  simulation, whole (the cost and prefill figures) or for one column (the
  mutation table's prefill); the line of rows names a week the simulation
  does not cover.
- `drawsLines` (optional): true for a figure that draws its series as lines,
  whose legend then shows a short line per series instead of a square.
- `isWide` (optional): true for a figure whose card takes its section's whole
  width: one that needs the room, or that would otherwise sit alone in a row.
- `legend` (a figure of more than one series): `legend(rows, colours, seriesColumn)`
  returns the series its legend lists and their colours, `{ series, colours }`,
  each series `{ name, label }`. The page draws the legend as buttons that
  hide and show a series (`explore/legend.js`), redrawing the chart from the
  rows it already has; from the keyboard the legend is one tab stop, the
  arrow keys moving between its buttons. It lists every series the chart
  draws.
- `drawnRows` (optional): `drawnRows(rows, colours)` returns the rows of the
  query the figure draws, when it draws fewer: a line or CDF per provider or
  model draws only those with one of the eight series colours, never one in
  the Other grey. The line of rows counts these, and thin bins are hidden
  among them.
- `seriesColumn` (a figure whose rows each name their series): that column. A
  hidden series' rows are left out before `draw` is called; a figure with a
  `legend` and no `seriesColumn` holds its series in columns and leaves out
  those in `hidden` itself.
- `draw(rows, body, colours, hidden)`: draws the rows, thin bins hidden, into
  `body`. `colours` holds the colours every figure shares (`{ models,
  categories, providers }`, each a Map from name to colour) and, for a figure
  with a `legend`, the legend's as `series`; `hidden` is the Set of the
  series names the legend hides.

A **histogram figure** has no `binColumn` and no `draw`: its `query` is a
bins query, `explore/<prefix>_bins` (each row a bin's `bin_start`, `bin_end`
and `rows`), and its `statsQuery` the matching `explore/<prefix>_stats` (one
row of `count`, `max` and the 50th, 75th, 90th and 95th percentiles). The page
draws it with `shared/histogram.js`, every bin shown, one line above it of
the median, the 95th percentile and, with `showsMaximum`, the maximum, and
its count as its line of rows, from the fields `countLabel` (what a bin
counts), `xLabel` (optional, the value axis's title), `format` (a value in the
summary and the tooltip), `tickFormat` (optional, a value on the axis),
`logScale`, `logCounts` (optional, a log count axis) and
`ticks(domain, maxTicks)` (optional, a log axis's ticks).

```js
Object.freeze({
  name: "tokens_per_request_cdf",
  title: "Tokens per request",
  insight: "Each request adds little to a large context.",
  definition: "Share of requests with at most each number of input tokens, uncached input tokens (where the provider reports cache reads) and output tokens (where there are more than one).",
  caption: "Input, uncached input and output tokens of each request.",
  drawsLines: true,
  query: "figures/tokens_per_request_cdf",
  binColumn: "series",
  seriesColumn: "series",
  seriesOverSameRows: true,
  legend: tokensPerRequestLegend,
  draw: drawTokensPerRequest,
}),
```

**Adding a figure.** A figure ends at its answer and its words: one query,
answered by `make data`, one draw function over the answer's rows, its card's
words, and their tests. Nothing about it runs in the browser.

1. **The query**, `site/queries/figures/<name>.sql`, as above: the population
   from the selection tables, so `make data` answers it for every week and the
   paper's harnesses; where thin bins are to be hidden, a
   column naming each row's bin or series and that bin's count in `rows`. List
   its columns in `EXPECTED_COLUMNS` of `tests/test_queries.py`, and test its
   numbers on the fixture, counted by hand, in its section's query test
   (`test_figure_queries.py`, `test_session_figure_queries.py`,
   `test_caching_queries.py`, `test_comparison_queries.py` or, for a figure of
   the cache simulation, `test_caching_simulation_queries.py`).
2. **The answer.** Run `make data PIPELINE=<the pipeline's checkout>`, which
   writes `site/data/all_weeks/figures/<name>.json` and the query's hash in
   `queries.json`, and commit `site/data` with the change. `tests/test_answers.py`
   runs every figure query live on the fixture and compares it with the answer
   written for it, and fails on a query with no rows there, so the fixture must
   hold a case of the figure.
3. **The entry and the draw function**, in its section's module or a module
   it takes entries from (`js/figures/`, `js/simulation/`, `js/comparison/`):
   a frozen figure entry with its `title`, an `insight` of one sentence and
   at most twenty words, a `caption` of up to three sentences and forty
   words total, and a `definition` of up to three
   short sentences and at most sixty words in total, and a
   draw function that loads Plot where it needs it and colours its series
   from `colours`. Its
   pure parts (rows to series, bars or stacks) are exported and tested with
   `node --test`. Add its name to its section's list in `SECTION_FIGURES` of
   `tests/figure_sections.test.js`, which checks the legend's shape;
   `tests/figure_words.test.js` counts the words of its insight, caption and
   definition, and of each section's takeaway.
4. **The legend**, for a figure of more than one series: `legend(rows,
   colours, seriesColumn)` (`seriesLegend` in `figures/figure_rows.js` builds
   one from rows that name their series), and either a `seriesColumn` or a
   `draw` that leaves out the series named in `hidden`. A series that is a
   model, category, cause, transition or gap bin takes that thing's colour.
5. **Parity**, when the paper's `numbers.json` holds a number the figure
   shows: compare it in `tests/test_paper_parity*.py`, which reads the
   query's shipped answer, `site/data/all_weeks/<query>.json`, through
   `answer(name)`.
6. **A mirror test**, when the query or a module restates a pipeline
   definition or copies a constant (a bin edge, a price, a list of causes): a
   test in `tests/test_pipeline_mirrors*.py` that parses the copy and compares
   it with the pipeline's own; then the query joins the list of restating
   queries in the rules above and `RESTATING_QUERIES` of
   `tests/test_pipeline_mirrors.py`, which checks that a mirror test reads
   it.
7. **The differences.** Where the figure is drawn more simply than the paper,
   an item of README's "Where the numbers come from" says how; the definition
   says what is drawn and leaves the paper out, which
   `tests/test_differences.py` checks.

## JavaScript style

- ES modules only. `import { thing } from "./module.js"`, with the `.js`
  extension; namespace imports only for a library in `libraries.js`.
- Nothing outside `libraries.js` imports it statically: node cannot load
  the CDN's `https://` modules, so a module that did would be untestable.
  A function that draws loads what it needs where it needs it,
  `const { Plot } = await import("./libraries.js");`, with a one-line
  comment saying why. The module's pure functions then stay
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
  and `--token-output`, slots no part of a session's time takes, and the
  roles of the input take none of theirs, so that a chart of tokens and one
  of time or of roles never give one hue two meanings; their names have
  one home each, `TOKEN_PART_NAMES` in `session/token_parts.js` and
  `TIME_PART_NAMES` in `theme/colours.js`. The same model, provider or wait cause has the
  same colour in every chart; the harnesses take the series slots from
  `HARNESS_FIRST_SLOT`, the models from the first, so the two donuts do
  not open on one colour. A tool category has one colour in every chart
  (`TOOL_CATEGORY_COLOURS` in `theme/colours.js`, the one home of category
  and colour): a category with a tool group takes the group's, each of the
  six without one a `--tool-category-*` token of its own, and only the
  category Other the Other grey. A wait cause, a role of the input, a transition and a gap bin
  always take `--cause-*`, `--role-*`, `--transition-*` and `--gap-bin-1` to
  `--gap-bin-6`, read through `CAUSE_COLOURS`, `ROLE_COLOURS`,
  `TRANSITION_COLOURS` and `GAP_BIN_SLOTS` in `theme/colours.js`; the parts of
  a session's time take `--part-prefill`, `--part-decode`, `--part-tool` and
  `--part-user`, blue, orange, green and red as the paper draws them, read
  through `TIME_PART_COLOURS`. The palette is Open Data's tokens (paper,
  surfaces, inks, rule and crimson) in light and the same inks turned over in
  dark, with our eight series slots: eight OKLCH hues no two closer than 30°,
  each the same hue in both schemes, most at one lightness and the rest set
  apart in lightness so that a red-green colour-blind reader can tell every
  pair apart.
  `tests/palette_contrast.test.js` is the validation: it reads both schemes
  from `style.css` (through `tests/palette.js`) and checks every series,
  part, cause, role, token, transition, tool-group, tool-category and
  gap-bin colour at 3:1 on its scheme's card, every text colour
  at 4.5:1 on the paper and on a card, each slot's hue across the schemes,
  the hues' spread, every pair of slots at an OKLab distance of 5 under a
  deuteranopia simulation, and the parts' hues against the paper's;
  `tests/palette_meanings.test.js` checks that the token parts, the time
  parts and the roles keep apart, and each group-less category's hue from
  every group's and every other's. A new
  colour token is named there as text, a mark or a tint, or the test fails.
  Protanopia and tritanopia are not simulated, so no series is told by its
  colour alone: every chart ships a legend and a hover tooltip,
  and tables stay available where values matter.
- **Marks.** Thin lines (2px), small markers, a 2px gap between stacked
  segments, grid and axes in `--chart-grid` and `--chart-axis`, labels in
  `--chart-label`. Text is never coloured by series.
- **One axis.** Two measures of different scale are two charts.
- **The card.** A figure of the Insights shows its title, its insight, its
  legend above the chart (none, and no room kept for one, where it has a
  single series), its evidence caption under the chart, and a Definition
  control that opens on its full definition and
  the rows it rests on. A legend names only what is drawn, and everything
  drawn has an entry or a label on the chart; a note such as a ratio of
  medians is written on the chart, not in the legend. After each drawing the
  chart is named for a screen reader by its title and insight (or caption),
  `nameChart` in `shared/charts.js`. Bars start at zero, and a label written
  by a line sits off every line (`lineLabels` of `shared/cdf.js`).
- **Axis text.** At most six ticks per axis (`axes/ticks.js`), no minor
  gridlines on a log axis, no arrow on an axis title, and no title that the
  card's title or legend already gives; a y-axis title says what is counted
  ("Share of requests"), and an x axis whose ticks carry no unit has a title
  ("Tokens"). One format per quantity: an axis's ticks as "1 s", "1 min",
  "1 h", "1 d", percentages without decimals and counts as "1k", "1M"
  (`formatDurationTick`, `formatPercent`, `formatCountTick`); a value in a
  legend, a tooltip, a table or a card with one decimal kept ("63.0 min",
  "94.0%", "129.1k", and three figures in billions, "2.04B"), in seconds only
  under a minute (`formatSeconds`, `formatShare`, `formatCompactCount`).

## Verifying a change

```bash
make test PIPELINE=<the pipeline's checkout>   # with the paper-parity tests
make serve     # then open http://localhost:8000
```

Before committing anything that touches a page: open it at 360 px wide and
at desktop width, in light and dark mode; check the console is clean; check
that the session list's filter survives a reload, a link to another page
and the Session page's link back. `make
setup-browser` installs a headless Chromium; a short Playwright script from
the virtual environment (`.venv/bin/python`) can open `http://localhost:8000`,
collect the console and take the screenshots.

One task per commit, `make test` green at every commit. Commit messages say
what changed and why in one line, and end with the attribution line the
repository's `CLAUDE.md` gives.
