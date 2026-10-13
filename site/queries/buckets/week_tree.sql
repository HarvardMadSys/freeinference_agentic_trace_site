-- One row per session of the selected weeks, every harness's, with the columns the Session page's facts card and agent
-- tree read: each top-level session and its subagents at every depth, by top-level session, then the top-level session
-- first and each depth in order of its first request. `make data` selects one week at a time and writes each top-level
-- session's rows into its bucket (site_data/buckets.py), `root_session_id` naming the bucket entry.
SELECT
  root_session_id,
  session_id,
  parent_session_id,
  spawned_by_step,
  depth,
  harness,
  requests,
  user_steps,
  tool_calls,
  first_start_ms,
  duration_s,
  input_tokens,
  reported_input_tokens,
  cached_tokens,
  output_tokens,
  subagents,
  subagent_requests
FROM sessions
WHERE week IN (SELECT week FROM selected_weeks)
ORDER BY root_session_id, depth, first_start_ms, session_id;
