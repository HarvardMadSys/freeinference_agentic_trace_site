-- One row per tool call of the selected session's tree, by session, step and the call's place in its response.
SELECT
  session_id,
  step,
  call_index,
  name,
  category,
  programs,
  arguments_skeleton,
  outcome,
  result_tokens,
  latency_ms
FROM tool_calls
WHERE week = (SELECT week FROM selected_session)
  AND root_session_id = (SELECT root_session_id FROM selected_session)
ORDER BY session_id, step, call_index;
