# Working in this repository

This is the FreeInference trace site: a static, public visualizer and explorer
for the agentic trace. Start with `README.md` (what it is and how to run it)
and `CONTRIBUTING.md` (the rules, the patterns to copy, how to verify a
change). The specifications are in `openspec/`; the change that builds the
site is `openspec/changes/site-first-release/`.

The rules in `CONTRIBUTING.md` are binding. The ones that matter most:

- Simple, readable and maintainable first; no optimisation without a
  measurement recorded in `design.md`.
- Plain HTML, CSS and ES modules. No framework, no bundler, no npm
  dependency; library URLs only in `site/js/shared/libraries.js`.
- SQL only in `site/queries/*.sql`; queries read the selection from the
  selection tables, never from assembled strings.
- Every definition comes from the pipeline's functions, called by
  `site_data`; the browser only filters, counts, sums and takes quantiles.
- Names are words; functions ≤ 50 lines; modules ≤ 300 lines; every module
  has tests.

## Verifying a change

```bash
make test                 # pytest and node --test; passes at every commit
make serve                # look at every touched page at 360 px and desktop, light and dark
```

## Git

One commit per task, `make test` green at every commit. Never push without
being asked. Commit messages end with
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
