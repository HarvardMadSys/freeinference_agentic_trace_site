-- One row: how many top-level sessions of the selected weeks and scope there are, and the largest and the exact 50th, 75th, 90th and 95th percentiles of their subagent sessions per session.
-- A top-level session is one no other session spawned, so it has no parent.
SELECT count(subagents) AS count,
       max(subagents) AS max,
       quantile_cont(subagents, 0.5) AS p50,
       quantile_cont(subagents, 0.75) AS p75,
       quantile_cont(subagents, 0.9) AS p90,
       quantile_cont(subagents, 0.95) AS p95
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes);
