# Change: session-buckets

## Why
Opening a session is slow. The Session page starts DuckDB in the browser
(a 6.8 MB engine) and fetches the whole week's four Parquet files (5 to
14 MB) before it can draw, because the host answers range requests with
whole files. The rows one session needs are a few kilobytes.

The stats strip and the Session Explorer also disagree at a glance: the
strip counts the human-driven sessions (10,967) while the list counts
every session (12,002), and the paper's Table 1 counts every session too.

## What changes
- **Every session precomputed, in buckets.** `make data` writes, per week,
  the rows of every top-level session with its subagents into gzipped JSON
  buckets keyed by the first two characters of the top-level session id,
  `site/data/session_buckets/<week>/<xx>.json.gz`, plus a small gzipped
  index per week from every session id (subagents included) to its
  top-level id. About 4,100 files for 16 weeks, 84 MB gzipped in all,
  median bucket around 20 KB.
- **The Session page reads one bucket.** It fetches the bucket its id
  names, decompresses it in the browser with `DecompressionStream`, and
  draws; a subagent's id falls back to the week's index. No DuckDB module,
  no Parquet file and no SQL on the Session page. The three session
  queries become the three per-week bucket queries the data step runs.
- **Parquet stays tracked** for the data step and the dormant recompute
  path; no visitor fetches it.
- **One count everywhere.** The stats strip shows the whole trace as the
  paper's Table 1 does (12,002 sessions, 1.19M requests, 209.2B input
  tokens, 1.21M tool calls, 13 harnesses and the benchmark), and its line
  says that 1,035 sessions are a benchmark replay left out of the mixes
  and the Insights. The Session Explorer's count line then matches.

## Impact
- Specs: `site-data` (buckets and index, size limits, the trace-totals
  answer), `session-page` (opening a session), `site-repository` (layout,
  the switch covers the landing page only, shipped data), `explore-page`
  (the stats strip).
- Code: `site_data/` (a buckets module, the trace totals), `queries/`
  (`session/` replaced by `buckets/`, a new `explore/trace_totals.sql`),
  `js/pages/session.js` and a new `js/session/bucket.js` loader,
  `js/landing/stats.js`, `js/shared/database.js` (loadWeekRows and the
  Session page's DuckDB path removed), tests, README, CONTRIBUTING.
- Data: `make data` rebuilds; `site/data` grows by about 85 MB of
  buckets and is committed with the change.
