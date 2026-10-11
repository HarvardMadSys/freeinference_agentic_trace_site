-- One row: how many top-level sessions of the selected weeks and harnesses there are, and the largest and the exact 50th, 75th, 90th and 95th percentiles of their requests per session.
-- A top-level session is one no other session spawned, so it has no parent.
SELECT count(requests) AS count,
       max(requests) AS max,
       quantile_cont(requests, 0.5) AS p50,
       quantile_cont(requests, 0.75) AS p75,
       quantile_cont(requests, 0.9) AS p90,
       quantile_cont(requests, 0.95) AS p95
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
