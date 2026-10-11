# Tasks

Every task ends with `make test` green and one commit. A task that touches
a query or a column reruns `make data` and commits `site/data` with it. A
task that touches a view checks it in a browser at 360 px and at desktop
width, in light and dark mode. Where a task says "measure", the
measurement goes into `design.md`.

## 0. Before

- [ ] 0.1 Archive `one-page-all-weeks` and `ship-the-data`, carrying their two unticked deploy checks into task 8.1 here.
- [ ] 0.2 Aesthetic review: a reviewer goes through every page at desktop and 360 px, light and dark, and writes `design-review.md` beside this file: per page and per card, what to change so that a figure card is a title and one short caption with the definition and row count behind a control, a chart carries no text its axes and legend give, and spacing, sizes and type are consistent.

## 1. Site data

- [ ] 1.1 Tool calls keep `programs` and `arguments_skeleton` from the release; the fixture gives some calls programs and every call a skeleton; the fixture test checks a shell call's list, a native call's null and a skeleton. Measure the tool-call files' size before and after.
- [ ] 1.2 Simulation rows hold both scopes (`scope`: the pipeline's Agentic and benchmark names) under the TTL-only policy only, without `policy`, with the week's `span_seconds`; the fixture tests and the view statement follow.
- [ ] 1.3 Requests gain `user_prompt_tokens` (the pipeline's function) and `missed_tokens_no_ttl` (joined from the simulation's per-request misses; null for a week without a simulation); fixture tests.
- [ ] 1.4 The sessions-table answer holds every harness's sessions with `benchmark` marked; `answers.py` fills the selection tables once with every week and the paper's harnesses and nothing in the browser depends on them.

## 2. Explore: frozen figures, the table's filter

- [ ] 2.1 `FIGURES_ARE_FROZEN = true` in the Explore page's module: with it, no week or harness picker is mounted, every section and figure is drawn from its answer, figures draw at once rather than when in view, and neither DuckDB nor the stream starts; with it false, the previous behaviour, whose code and tests stay. `STREAM_ROWS_AFTER_DRAW = false`. Legends keep toggling series. Verify in the network panel that a visit fetches no `.wasm` and no `.parquet`, and measure the bytes transferred.
- [ ] 2.2 The sessions table's filter: a folded disclosure above the table, one line in words when closed, with month pills, harness pills (the benchmark marked), "every harness" and "the paper's harnesses", applied with the search to the answer's rows in the browser; `months` and `harnesses` in the URL set it, older keys are read and rewritten; the Session page's back link carries them. Node tests of the filter and the URL. Verify that `?months=2026-07&harnesses=codex` filters the table and changes no figure.

## 3. Figures

- [ ] 3.1 `prefill_against_storage` (both scopes, labelled points, log axes, tooltip) replaces `simulated_hit_ratio_by_ttl`, `retained_over_active` and `dead_over_active_by_policy`, whose queries, answers, tests, legend and About entries go; parity test against the paper's prefill and retained tokens.
- [ ] 3.2 `api_cost_by_ttl` and `infrastructure_cost_by_ttl`: stacked multiples of the one-minute total with the knee and the minimum marked; the prices mirrored and tested; parity test against the paper's knee and minimum.
- [ ] 3.3 `tool_mix_by_turn_position` (both scopes): the group rule and program sets mirrored and tested; stacked shares per tenth of a turn; parity against the paper's shares where it quotes them.
- [ ] 3.4 `calls_per_request_by_category` and `latency_by_batch_width` with the serial line; parity against the paper's numbers.
- [ ] 3.5 `speedup_if_twice_as_fast`: three bars from the session-time parts; parity test.
- [ ] 3.6 The four human-driven against benchmark CDFs (turn duration, session duration, input per request, user prompt tokens), each with both medians and their ratio; parity tests.
- [ ] 3.7 `mutations_by_cause`: a table card of shares of steps, sessions and infinite-retention prefill per transition and cause; parity test.

## 4. Session page

- [ ] 4.1 `database.js`: `loadWeekRows(week)` fetches the week's four files whole and registers each as a buffer, a failed fetch leaving that file on HTTP ranges; the Session page calls it before its queries. Measure the request count and the time to open the largest session before and after.
- [ ] 4.2 The details table gains a Programs column and a monospace skeleton line under each call; the chip's tooltip names the programs. Node tests of the cell and the line.

## 5. Type

- [ ] 5.1 `style.css`: base 18 px; no text under 14 px; chart tick labels and legends follow. Verify every page at 360 px and desktop, light and dark.

## 6. The look

- [ ] 6.1 Apply `design-review.md`: figure cards with a title and one short caption, the definition and row count behind a control, chart text pruned, spacing and sizes made consistent, on every page; the About page's figure list follows the captions. Verify every page at 360 px and desktop, light and dark.
- [ ] 6.2 The reviewer looks again and writes what remains at the end of `design-review.md`; what remains is fixed or ruled on.

## 7. Data and docs

- [ ] 7.1 `make data`; commit `site/data`; README (what the page does, the switch, the measurements, the layout), About (figure list, definitions, the frozen population), CONTRIBUTING (adding a figure now ends at the answer), `tests/test_about_page.py` and `tests/test_repository.py` follow.

## 8. Deploy

- [ ] 8.1 Once the site has a GitHub repository: `make deploy`, then check on the host that a Parquet range request is answered with 206 and that the deployed Explore and Session pages work end to end.
