-- One row: the totals of the top-level sessions in the selected weeks and harnesses, each over the session's own requests.
-- A top-level session is one no other session spawned, so it has no parent; its subagents are counted in `subagents`.
-- reported_input_tokens is the input of the requests whose provider reports cache reads, the input the cached share is taken of.
SELECT count(*) AS sessions,
       count(DISTINCT user_id) AS accounts,
       coalesce(sum(requests), 0) AS requests,
       coalesce(sum(input_tokens), 0) AS input_tokens,
       coalesce(sum(output_tokens), 0) AS output_tokens,
       coalesce(sum(tool_calls), 0) AS tool_calls,
       coalesce(sum(subagents), 0) AS subagents,
       coalesce(sum(reported_input_tokens), 0) AS reported_input_tokens,
       coalesce(sum(cached_tokens), 0) AS cached_tokens
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
