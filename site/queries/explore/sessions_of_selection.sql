-- One row per top-level session of the selected weeks and harnesses, with its totals over its own requests; most input first.
-- A top-level session is one no other session spawned, so it has no parent; `subagents` counts its subagents at every depth.
-- `benchmark` is true when the session's harness is the benchmark's. The data step answers this query with every
-- harness selected, the benchmark's too, so the table can filter its answer to any harness without a query.
-- reported_input_tokens is the input of its requests whose provider reports cache reads, the input its cached share is taken of.
SELECT week,
       session_id,
       first_start_ms,
       harness,
       harness IN (SELECT harness FROM benchmark_harness) AS benchmark,
       main_model,
       requests,
       user_steps AS turns,
       subagents,
       tool_calls,
       duration_s,
       input_tokens,
       reported_input_tokens,
       cached_tokens,
       peak_prompt_tokens
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
ORDER BY input_tokens DESC, session_id;
