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
  query reads the selection from the tables `selected_weeks`,
  `selected_scopes` and `selected_session`, and from nothing else.
- **Every definition comes from the pipeline.** The browser filters, groups,
  counts, sums and takes quantiles. It never decides what a turn, a scope, a
  wait or a cache hit is; `site_data` computes those by calling the pipeline's
  functions.
- **No framework, no bundler, no npm dependency.** Plain HTML, CSS and ES
  modules. Libraries come from a CDN at exact versions, named only in
  `site/js/shared/libraries.js`.
- **Only what is needed.** Add a module, a column, a token or a dependency
  when a task needs it, not before.

## How the site is put together

```
page (html)  →  js/pages/<page>.js  →  shared modules  →  queries/<page>/<name>.sql  →  site/data/*.parquet
```

- An HTML file is a shell: a header, titled sections with ids, a footer, and
  one `<script type="module">`. It holds no data and no inline script.
- The page module mounts the header and footer, reads the selection from the
  URL, opens the database, and fills each section.
- `shared/database.js` opens DuckDB once, registers the Parquet files as the
  views `requests`, `tool_calls`, `sessions` and `simulation`, and runs a
  query by name: `runQuery("explore/request_count")` fetches
  `queries/explore/request_count.sql`.
- `shared/selection.js` owns the week picker, the scope switch and the URL,
  fills the selection tables, and emits `change`.
- A figure is `{ name, title, definition, draw }`, listed in its section's
  module under `js/figures/`. `name` is both the query's file name and the
  figure's element id.

## Patterns to copy

**A query** (`site/queries/explore/request_count.sql`):

```sql
-- The number of requests of the top-level sessions in the selected weeks and scope.
SELECT count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes);
```

The first line says what one row is. Columns are named in words. Every
query is run by `tests/test_queries.py` against the fixture data.

**A pure JavaScript module with its test** (`site/js/shared/format.js`,
`tests/format.test.js`): exported functions with one-line JSDoc, module-level
constants with a comment, helpers below the exports, and a `node --test` file
with one `test()` per behaviour.

**A Python module with its test** (`site_data/weeks.py`, `tests/test_weeks.py`):
a module docstring stating the definition, a frozen dataclass for anything
that crosses a boundary, and functions that each do one job.

**A figure entry** (to be listed in `js/figures/<section>.js`):

```js
{
  name: "tokens_per_request_cdf",
  title: "Tokens per request",
  definition: "CDF over requests of input, uncached input and output tokens.",
  draw(rows, container) { ... },
}
```

## JavaScript style

- ES modules only. `import { thing } from "./module.js"`, with the `.js`
  extension; namespace imports only for a library in `libraries.js`.
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
  same colour in every chart. The palette was validated for colour-vision
  deficiency in both modes; three light-mode slots sit under 3:1 contrast on
  white, so every chart ships a legend and a hover tooltip, and tables stay
  available where values matter.
- **Marks.** Thin lines (2px), small markers, a 2px gap between stacked
  segments, grid and axes in `--chart-grid` and `--chart-axis`, labels in
  `--chart-label`. Text is never coloured by series.
- **One axis.** Two measures of different scale are two charts.
- **Captions.** A figure shows its title, a one-sentence definition, the
  number of rows it rests on, and the scope and weeks it shows. Where the
  site draws more simply than the paper, the definition says so.

## Verifying a change

```bash
make test
make serve     # then open http://localhost:8000
```

Before committing anything that touches a page: open it at 360 px wide and
at desktop width, in light and dark mode; check the console is clean; check
that the selection survives a reload and a link to another page.

One task per commit, `make test` green at every commit. Commit messages say
what changed and why in one line, and end with the attribution line the
repository's `CLAUDE.md` gives.
