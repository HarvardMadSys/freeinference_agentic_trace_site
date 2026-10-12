# Working in this repository

This is the FreeInference trace site: a static, public visualizer and explorer
for the agentic trace. Start with `README.md` (what it is and how to run it)
and `CONTRIBUTING.md` (the rules, the patterns to copy, how to verify a
change). The specifications are in `openspec/`; the change being built is
`openspec/changes/ship-the-data/`.

The rules in `CONTRIBUTING.md` are binding. The ones that matter most:

- Simple, readable and maintainable first; no optimisation without a
  measurement recorded in `design.md`.
- Plain HTML, CSS and ES modules. No framework, no bundler, no npm
  dependency; library URLs only in `site/js/shared/libraries.js`.
- SQL only in `site/queries/*.sql`; queries read the selection from the
  selection tables, never from assembled strings.
- Every definition comes from the pipeline. Where a query restates one in
  SQL (the cost share's prices, the rank bins, the wait classes, what a tool
  wait is, the tool groups, the cache simulation's TTLs and costs, the
  mutation table), a mirror test ties each copied constant to the pipeline's
  and a parity test ties the number to the paper's:
  `figures/cost_share_by_session.sql`, `figures/session_time_by_part.sql`,
  `figures/calls_per_request_by_category.sql`,
  `figures/latency_by_batch_width.sql`, `figures/tool_mix_by_turn_position.sql`,
  `figures/prefill_against_storage.sql`, `figures/api_cost_by_ttl.sql`,
  `figures/infrastructure_cost_by_ttl.sql` and `figures/mutations_by_cause.sql`.
  Otherwise `site_data` calls the pipeline's functions, and the browser only
  filters, counts, sums and takes quantiles.
- Names are words; functions ≤ 50 lines; modules ≤ 300 lines; every module
  has tests.
- `make data` follows every edit to a query under `site/queries/explore/`,
  `site/queries/figures/` or a colour order: the default view reads the
  answer `make data` precomputed, not the query.

## Verifying a change

```bash
make test                 # pytest and node --test; passes at every commit
make serve                # look at every touched page at 360 px and desktop, light and dark
```

## Git

One commit per task, `make test` green at every commit. Never push without
being asked. Commit messages end with
`Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
