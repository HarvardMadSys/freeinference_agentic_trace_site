-- One row per request of the selected weeks, every harness's, with the columns the Session page's views read: by
-- top-level session, session and step. `make data` selects one week at a time and writes each top-level session's
-- rows, its subagents' included, into its bucket (site_data/buckets.py), `root_session_id` naming the bucket entry.
SELECT
  root_session_id,
  session_id,
  step,
  turn,
  step_trigger,
  start_ms,
  end_ms,
  ttft_ms,
  model,
  provider,
  prompt_tokens,
  cache_read_tokens,
  uncached_tokens,
  completion_tokens,
  system_tokens,
  user_tokens,
  assistant_tokens,
  tool_tokens,
  tool_definition_tokens,
  n_messages,
  finish_reason,
  transition,
  cause,
  waited_for,
  wait_s
FROM requests
WHERE week IN (SELECT week FROM selected_weeks)
ORDER BY root_session_id, session_id, step;
