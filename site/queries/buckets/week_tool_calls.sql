-- One row per tool call of the selected weeks, every harness's, with the columns the Session page's views read: by
-- top-level session, session, step and the call's place in its response. `make data` selects one week at a time and
-- writes each top-level session's rows, its subagents' included, into its bucket (site_data/buckets.py),
-- `root_session_id` naming the bucket entry.
SELECT
  root_session_id,
  session_id,
  step,
  name,
  category,
  programs,
  arguments_skeleton,
  outcome,
  result_tokens,
  latency_ms
FROM tool_calls
WHERE week IN (SELECT week FROM selected_weeks)
ORDER BY root_session_id, session_id, step, call_index;
