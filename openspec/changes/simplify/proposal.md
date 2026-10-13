# Change: simplify

## Why
The site will be maintained by one person who did not write it. Three
reviews of the code found about a third of it serving things the site no
longer does: a browser query path (DuckDB, week and harness pickers, a
row stream) kept behind a switch that is off; 84 MB of Parquet row files
shipped with every deploy and read by nothing but the build step that
wrote them; wrappers, flags and modules with one caller; tests that pin
prose or repeat one another; and docs that describe the same thing in
three places. None of it changes what a visitor sees, and all of it costs
the maintainer reading time.

## What changes
Nothing a visitor sees or can do changes. Every figure, table, view,
filter and link stays as it is. The change is to what is behind them.

- **The browser query path goes.** `FIGURES_ARE_FROZEN`, DuckDB in the
  page (`js/engine/`), the pickers, the stream, the selection tables in
  the browser, and the branches that served a changing selection. The
  Explore page reads answer files and nothing else.
- **The Parquet row files leave `site/`.** `make data` builds the
  answers and the buckets from frames in memory and writes nothing the
  site does not serve; the row files are not written at all. `site/data`
  holds the indexes, the answers and the buckets: about 84 MB instead of
  168 MB in the repository and in every deploy. The paper-parity tests
  read the shipped answers, which is what visitors see.
- **One caller, one form.** Draw and legend wrappers become the entry's
  own arrow; modules only one other imports fold into it; the five input
  roles, the halo style, the violet slot and the small helpers exist
  once; options always given the same value go.
- **Tests test behaviour.** Tests that pin prose, flag values, fetch
  counts or markup details go, and tests that repeat one another keep
  one copy. The queries no page reads go with their tests.
- **One place per fact in the docs.** The bucket format, the restating
  queries and the folder map are each written once; the dormant path's
  prose goes; `CLAUDE.md` is the pointer and the git rules;
  `docs/differences.md` folds into README.
- **Tooling.** `make serve` is Python's own HTTP server, since no page
  reads byte ranges; the `check-answers` command goes, the test that
  does the same stays; the deploy check asks for a bucket index.
- **The specs are squashed** into three files that describe the site as
  it is, and the archived changes leave the tree: git history keeps them.

## Impact
- Specs: `site-repository` (the switch removed, layout, deployment, the
  built data, tests), `site-data` (no row files; answers from frames;
  what the folder holds), `explore-page` (the headline numbers'
  population), `week-selection` (the browser fills no table). Then the
  squash, by hand, after this change is archived.
- Code: about 1,700 lines of JavaScript, 90 of CSS, 400 of Python and
  SQL, 1,300 of tests, 300 of docs and 7,000 lines of archived specs
  removed; four to eight modules fewer.
- Data: `make data` reruns once; the answers are compared byte for byte
  with the shipped ones before the row files are dropped, and any
  difference is a float's last bits, recorded.
