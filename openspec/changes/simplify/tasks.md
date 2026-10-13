# Tasks

Every task ends with `make test` green and one commit, passes the gate of
design §0 (the snapshot diff empty, or only the differences §0 allows),
and is reviewed against the design and CONTRIBUTING before the next
starts. A final whole-branch review closes.

- [ ] 0.1 The gate: the snapshot script in the scratch folder, the baseline over the nine page states, the answers' checksums. Done when a second run at the same commit gives an empty diff.
- [x] 1.1 The browser query path out of the JavaScript, CSS, HTML and tests (design §1). Done when no module under `site/js` names DuckDB, a Parquet file, a picker or a stream, `js/engine` is gone, and the gate's diff is empty.
- [x] 2.1 The build from frames (design §2): `site_data` without the row files or the no-simulation case, the unread queries and columns dropped, the parity tests on the answers, `make data` rerun, the answers compared with the baseline, `site/data/<kind>/` deleted. Done when `site/data` holds no `.parquet`, the answers differ from the baseline by nothing or by listed last-bit floats, and the gate's diff is empty.
- [x] 3.1 One caller, one form in the figure and session modules (design §3: the wrappers, the folded modules, the things written once). Done when each item of those groups is applied or its reason for staying is in the report, and the gate's diff is empty.
- [x] 3.2 One caller, one form in the explore and shared modules (design §3: the dropped options, the table, the section hook, `TIP_STYLE`). Done likewise, with the two tooltip screenshots.
- [ ] 4.1 Tests that test behaviour (design §4). Done when every listed test is removed or reduced and `make test` is green.
- [x] 5.1 Docs and tooling (design §5). Done when each fact named there is written once, `serve.py` and `check_answers.py` are gone, and `make serve`, `make test`, `make data --help`-level commands in README all work as written.
- [ ] 6.1 The whole-branch review and its fixes, then merge and archive.
