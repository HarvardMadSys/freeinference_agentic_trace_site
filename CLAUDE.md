# Working in this repository

This is the FreeInference trace site: a static, public visualizer and explorer
for the agentic trace. Start with `README.md` (what it is, how to run it, the
map of the folders) and `CONTRIBUTING.md` (the rules, the patterns to copy,
how to verify a change). The specifications are in `openspec/specs/`; a change being
built is a folder of `openspec/changes/`, and a finished one lives in git
history.

The rules in `CONTRIBUTING.md` are binding. The ones that matter most:

- Simple, readable and maintainable first; no optimisation without a
  measurement recorded in `design.md`.
- Plain HTML, CSS and ES modules. No framework, no bundler, no npm
  dependency; library URLs only in `site/js/shared/libraries.js`.
- SQL only in `site/queries/*.sql`, read by `make data`, never assembled
  from strings.
- Every definition comes from the pipeline; a query that restates one is
  listed in `CONTRIBUTING.md` and has a mirror test.
- Names are words; functions ≤ 50 lines; modules ≤ 300 lines; every module
  has tests.
- The pages read what `make data` wrote, never a query: after editing a
  query, a colour order or a column, run
  `make data PIPELINE=<the pipeline's checkout>`, then `make snapshots`, and
  commit `site/data` and `tests/snapshots` with the change.

## Verifying a change

As `CONTRIBUTING.md`'s "Verifying a change" says.

## Git

One commit per task, `make test` green at every commit. Never push without
being asked. Commit messages end with
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
