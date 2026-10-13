# Tasks

Every task ends with `make test` green and one commit, passes the gate of
design §0 (the snapshot diff empty or every difference accepted), and is
reviewed by a reviewer against the design and CONTRIBUTING before the
next starts. A final whole-branch review closes.

- [ ] 0.1 The gate: the snapshot script in the scratch folder, a baseline over the landing page (six topics) and one session (three views), and the shipped answers' checksums.
- [ ] 1.1 The browser query path out of the JavaScript, CSS, HTML and tests (design §1).
- [ ] 2.1 The build from frames: `site_data` without the row files, the no-simulation case, the unread queries and columns; the parity tests on the answers; `make data`; the answers compared; `site/data/<kind>/` deleted (design §2).
- [ ] 3.1 One caller, one form in the figure and session modules (design §3, first three groups).
- [ ] 3.2 One caller, one form in the explore and shared modules (design §3, the dropped options, the table, the section hook, `TIP_STYLE`).
- [ ] 4.1 Tests that test behaviour (design §4).
- [ ] 5.1 Docs and tooling (design §5).
- [ ] 6.1 The whole-branch review, then merge; after archiving, the spec squash and the archive's removal by hand (design §6).
