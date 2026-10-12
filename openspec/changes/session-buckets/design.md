# Design: session-buckets

## 1. The buckets

For each week, `make data` runs three queries under `queries/buckets/`
over that week's files, ordered by top-level session, session and step:
- `week_tree.sql`: the session rows of the week with the columns the facts
  card and the agent tree read (the former `session/session_tree.sql`
  without its session filter);
- `week_requests.sql`: the request rows (the former `session_requests.sql`);
- `week_tool_calls.sql`: the tool-call rows (the former
  `session_tool_calls.sql`).

It groups the rows by `root_session_id` and writes
`site/data/session_buckets/<week>/<xx>.json.gz`, where `xx` is the first
two characters of the top-level session id, holding

```json
{ "<root_session_id>": { "tree": {"columns": [...], "rows": [[...]]},
                         "requests": {...}, "tool_calls": {...} }, ... }
```

in the answers' column-and-rows shape, with `root_session_id` dropped
from every row (it is the key). A prefix with no session in that week has
no file. Beside the buckets, `session_buckets/<week>/index.json.gz` maps
every session id of the week, subagents included, to its top-level id.

Gzip at the default level with a fixed mtime of 0, so a rebuild with the
same rows writes the same bytes and git sees no change. Measured on the
shipped data: 12,002 top-level sessions, 488 MB of JSON, 84 MB gzipped;
median file about 20 KB, worst 0.3 MB; about 4,100 files over 16 weeks,
256 added per week (Cloudflare allows 20,000 files and 25 MiB each).

The step prints the buckets' count and size. `queries.json` hashes the
bucket queries as it hashes the answers' queries, so an edited bucket
query without a rebuild fails `make test`.

## 2. Opening a session

`js/session/bucket.js` exports `fetchSession(dataUrl, week, id)`:
1. fetch `session_buckets/<week>/<id[0:2]>.json.gz`; decompress through
   `response.body.pipeThrough(new DecompressionStream("gzip"))` when the
   first two bytes are gzip's magic number, else read the body as text
   (a host that strips the compression itself); parse; if the bucket has
   `id`, return it;
2. else fetch `session_buckets/<week>/index.json.gz`; if `id` maps to a
   top-level id, fetch that bucket and return its entry;
3. else null: "session not found in this week".

The page shows its loading line until the bucket is parsed. Rows come
back as the objects the views already take (`{ tree, requests, toolCalls
}`, column names to values), so the views, the facts card, the tree and
the three views change nothing. The tool category colours come from the
shipped `setup/category_order` answer, which the landing page already
reads.

The Session page imports nothing from `js/engine/` and `js/shared/
database.js`; `loadWeekRows`, `setSession`, `runQueryWith` and the
`selected_session` view go, with their tests, since no page reads them.
The landing page's dormant recompute path keeps DuckDB behind
`FIGURES_ARE_FROZEN`.

## 3. One count everywhere

A new answer `explore/trace_totals.sql`, run like the sessions table over
every week and every harness: one row of sessions, requests, input tokens,
tool calls, harnesses and benchmark harnesses. The stats strip shows the
paper's Table 1 numbers: weeks, sessions (12,002), requests, input tokens,
tool calls and harnesses written "13 (+1)" as the paper writes it, and its
line names the span of dates only. Nothing on the strip mentions the
benchmark. The Session Explorer's count line reads "12,002 sessions", and
"N of 12,002 sessions" under a filter; the BENCHMARK chip on the replay's
rows stays. `headline_numbers` stays for the human-driven population the
mixes and the insights use.

Bucket size: two characters of the id give about 256 buckets per week,
three to four sessions each, 120 KB raw and 20 KB gzipped on average,
the largest 2 MB raw; one character would give 16 buckets of 2 MB raw and
330 KB gzipped each, too much to fetch for one session; three would give
thousands of near-empty files a week. Two is the middle.

## 4. Why not
- One file per session: the plainest, but 12,000 files now and 750 more
  per week reach the host's 20,000-file cap in about ten weeks.
- Range requests into one file per week: the host answers them with the
  whole file.
- Dropping the Parquet files: kept at the user's choice for the data step
  and the recompute path; nothing fetches them.

## 5. Out of scope
The Session Explorer's answer (4 MB, 1 MB gzipped), the views, the
figures.
