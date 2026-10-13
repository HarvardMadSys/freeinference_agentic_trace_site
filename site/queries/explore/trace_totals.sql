-- One row: the trace in the selected weeks and harnesses as the paper's summary table counts it; the data step answers
-- it with every week and every harness, the benchmark's too, so it counts the whole trace, as the session list lists it.
-- A top-level session is one no other session spawned, so it has no parent; its requests, tokens and tool calls are
-- its own, a subagent's counted in neither. `benchmark_harnesses` counts the harnesses that are the benchmark's,
-- which the stats strip writes apart from the others ("13 (+1)"). The strip does not show `output_tokens` and
-- `cached_tokens`; tests/test_paper_parity.py compares them, with the rest, with the paper's summary.
SELECT count(*) AS sessions,
       coalesce(sum(requests), 0) AS requests,
       coalesce(sum(input_tokens), 0) AS input_tokens,
       coalesce(sum(output_tokens), 0) AS output_tokens,
       coalesce(sum(cached_tokens), 0) AS cached_tokens,
       coalesce(sum(tool_calls), 0) AS tool_calls,
       count(DISTINCT harness) AS harnesses,
       count(DISTINCT harness) FILTER (WHERE harness IN (SELECT harness FROM benchmark_harness)) AS benchmark_harnesses
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
