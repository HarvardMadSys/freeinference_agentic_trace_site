-- One row per request of the selected session's tree, the top-level session's and every subagent's, by session and step.
SELECT
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
  wait_s,
  n_tool_calls
FROM requests
WHERE week = (SELECT week FROM selected_session)
  AND root_session_id = (SELECT root_session_id FROM selected_session)
ORDER BY session_id, step;
