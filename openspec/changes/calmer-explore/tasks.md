# Tasks

Every task ends with `make test` green and one commit. A task that touches
a query reruns `make data` and commits `site/data` with it. A task that
touches a view checks it in a browser at 360 px and at desktop width, in
light and dark mode. Where a task says "measure", the measurement goes
into `design.md`.

Archive `one-page-all-weeks` and `ship-the-data` before this change.

## 1. Site data

- [ ] 1.1 Tool calls keep `programs` from the release, a list column, null for calls that are not shell calls; the fixture release gives some calls programs; the fixture test checks a shell call's list and a native call's null.
- [ ] 1.2 Simulation rows hold the `ttl_only` policy only, without the `policy` column, and gain the week's `span_seconds` from its totals; the fixture tests, the view statement and the answer test follow.

## 2. Selection: months, folded

- [ ] 2.1 `selection.js`: the URL key `months`, none for the default; `month=`, `weeks=`, `weeks=all` and `scope` read as before, a listed week selecting its month, and rewritten; `isDefaultSelection` and the notes unchanged; the selection in words for the summary line. Node tests.
- [ ] 2.2 `selection_pickers.js`: a disclosure whose summary is the selection in words, open when the selection is not the default; inside, one pill per month with its weeks' count, "All months", the harness pills and buttons, the notes. No week pills. Verify in the browser that the default page shows one line, that choosing July alone writes `months=2026-07`, and that `?month=2026-07` and `?weeks=2026-07-05` both open July.

## 3. Prefix caching: one simulation figure

- [ ] 3.1 `figures/prefill_against_storage.sql` and its figure: one row per TTL with `mean_retained_tokens`, `normalised_prefill` and `rows`; points labelled by TTL on log axes, joined in TTL order, with a tooltip; its answer. Remove `simulated_hit_ratio_by_ttl`, `retained_over_active` and `dead_over_active_by_policy`, their queries, answers, tests and About entries; the policy legend goes. Parity test against the paper's normalised prefill and retained tokens.

## 4. Session page

- [ ] 4.1 `database.js`: `loadWeekRows(week)` fetches the week's four files whole and swaps each into memory, a failed fetch leaving that file on HTTP ranges; the Session page calls it before its queries. Measure the request count and the time to open the largest session before and after.
- [ ] 4.2 The details table gains a Programs column, joined by commas, blank for a call without; the chip's tooltip names them. Node test of the cell text.

## 5. Type

- [ ] 5.1 `style.css`: base 18 px; no text under 14 px; tick labels and legends of the charts follow. Verify every page at 360 px and desktop, light and dark.

## 6. Data and docs

- [ ] 6.1 `make data`; commit `site/data`; README's measurements and layout, About's figure list and definitions; `tests/test_about_page.py` follows.
