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
- **The specs' drift is fixed** where this change touches them; the
  squash into three files and the archive's removal follow in the change
  `lean`.

## Before and after
| | Now | After |
|---|---|---|
| `site/data` tracked and deployed | 168 MB, 3,451 files | about 84 MB, about 3,387 files |
| JavaScript under `site/js` | about 10,100 lines, 65 modules | about 8,400 lines, about 58 modules |
| Python under `site_data` | 1,344 lines, 12 modules | about 950 lines, 11 modules |
| SQL under `site/queries` | 64 files | 58 files |
| Tests | 10,460 lines | about 9,100 lines |
| README, CONTRIBUTING, CLAUDE.md, docs | 944 lines | about 650 lines |
| Specs | 5 files, 1,047 lines | 3 files, about 600 lines |
| `openspec/changes/archive` | 79 files, 6,993 lines | none, in git history |
| Pages, figures, views, filters, links | | the same |

## Decisions taken
1. The browser query path and the Parquet row files go. Recomputing
   figures in the browser would be a new change; the dataset's rows stay
   on Hugging Face and in the pipeline repository.
2. The archived changes leave the tree; git history keeps them (done in
   `lean`).
3. The specs are squashed into three files (done in `lean`).
4. Git history is not rewritten: the row files already pushed stay in
   the pack.

## Impact
- Specs: `site-repository` (the switch removed, layout, deployment, the
  built data, tests), `site-data` (no row files; answers from frames;
  what the folder holds), `explore-page` (the headline numbers'
  population), `week-selection` (the browser fills no table). Then the
  squash and the archive's removal, in `lean`.
- Code: about 1,700 lines of JavaScript, 90 of CSS, 400 of Python and
  SQL, 1,300 of tests, 300 of docs and 7,000 lines of archived specs
  removed; four to eight modules fewer.
- Data: `make data` reruns once; the answers are compared byte for byte
  with the shipped ones before the row files are dropped, and any
  difference is a float's last bits, recorded.
