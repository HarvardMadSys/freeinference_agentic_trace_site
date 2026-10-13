# Tasks

Every task ends with `make test` green (the snapshot test included once
it exists) and one commit, and is reviewed against the design and
CONTRIBUTING before the next starts. A final whole-branch review closes.

- [x] 1.1 The snapshot test: `tests/snapshot.py`, `tests/snapshots/`, `make snapshots`, `make test` comparing; the baseline committed. Done when a second run is green and a one-character change to a figure's insight is caught.
- [x] 2.1 One URL format (design §3). Done when the table reads its eight keys and no other, and the snapshots are green.
- [x] 3.1 `js/charts/`: the seven kinds, each with a focused test; the first family (Session structure) converted to one-call draws. Snapshots green.
- [x] 3.2 Tokens and cost, Latency converted. Snapshots green.
- [x] 3.3 Tools, Prefix caching, Human-driven against benchmark converted; the flags and their runner code removed; `shared/charts.js` reduced. Snapshots green.
- [ ] 4.1 The markup-pinning unit tests removed where a snapshot covers them; the pure-function tests kept. Done when `make test` is green and the removed tests are listed in the report.
- [ ] 5.1 The comment rule in CONTRIBUTING with its warning test, applied to the touched modules sentence by sentence.
- [ ] 6.1 The whole-branch review and its fixes, then merge and archive; then the spec squash and the archive's removal by hand (design §5).
