# Tasks

Every task ends with `make test PIPELINE=…` green and one commit. `make data`
runs once the bucket queries exist; the rebuilt `site/data` is committed
with task 1.2.

## 1. The data
- [ ] 1.1 `queries/buckets/{week_tree,week_requests,week_tool_calls}.sql` (the three session queries' columns, a whole week, ordered by top-level session, session, step); `queries/session/` removed; `site_data/buckets.py` groups the rows per top-level session and writes the gzipped buckets and the index per week, mtime 0, no empty bucket; `queries.json` hashes the bucket queries; the step prints the buckets' count and size; tests: a bucket's rows equal the query's rows for one top-level session, a subagent's id resolves through the index, a rebuild writes identical bytes, no week in `weeks.json` lacks its index.
- [ ] 1.2 `explore/trace_totals.sql` as an every-harness answer beside the sessions table's; `make data`; `site/data` committed (buckets, index, the new answer, `queries.json`); the repository test requires every week's bucket folder and index tracked.

## 2. The Session page
- [ ] 2.1 `js/session/bucket.js` (`fetchSession`: the bucket, the gzip check, the index fallback, null when absent) with node tests on fixture bytes (gzipped and plain); `pages/session.js` opens a session from it, loading line until parsed, category colours from the shipped answer; no import of `shared/database.js` or `js/engine/` on the Session page; `loadWeekRows`, `setSession`, `runQueryWith` and `selected_session` removed with their tests; browser check at 1280 and 360 px: the largest session (week 2026-08-30) and a session with subagents opened by the top-level id, by a subagent's id and by a wrong id, with the network tab showing one bucket fetch (two for a subagent's id) and no `.wasm` or `.parquet`.

## 3. The stats strip
- [ ] 3.1 `landing/stats.js` reads `trace_totals`: weeks, sessions, requests, input tokens, tool calls over every harness, harnesses "13 (+1)"; the line names the span of dates only; the Session Explorer's count line reads "12,002 sessions" and "N of 12,002 sessions" under a filter; tests and the specs' scenario strings follow.

## 4. Close
- [ ] 4.1 README (what a visitor downloads, the data folder's contents and size, the layout lines, the measurements for the Session page redone), CONTRIBUTING (how a session is served; the bucket queries), the site-data and session-page notes; `openspec validate session-buckets --strict`.
