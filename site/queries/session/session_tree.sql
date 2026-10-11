-- One row per session of the selected session's tree: the top-level session and its subagents at every depth,
-- the top-level session first, then each depth in order of its first request.
SELECT
  session_id,
  parent_session_id,
  spawned_by_step,
  depth,
  harness,
  main_model,
  user_id,
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
WHERE week = (SELECT week FROM selected_session)
  AND root_session_id = (SELECT root_session_id FROM selected_session)
ORDER BY depth, first_start_ms;
