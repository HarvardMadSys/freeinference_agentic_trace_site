-- One row per tool category, over the tool calls of the top-level sessions of the selected weeks and scope that were
-- their request's only call and have a latency (the wait after the request until the session's next; a batch's
-- calls share one): the category, its `rows` (those calls), and the 5th, 25th, 50th, 75th and 95th percentile of
-- their latency in milliseconds.
WITH single_calls AS (
  SELECT category,
         latency_ms,
         count(*) OVER (PARTITION BY week, session_id, step) AS calls_of_its_request
  FROM tool_calls
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
)
SELECT category,
       count(*) AS rows,
       quantile_cont(latency_ms, 0.05) AS p5,
       quantile_cont(latency_ms, 0.25) AS p25,
       quantile_cont(latency_ms, 0.50) AS p50,
       quantile_cont(latency_ms, 0.75) AS p75,
       quantile_cont(latency_ms, 0.95) AS p95
FROM single_calls
WHERE calls_of_its_request = 1
  AND latency_ms IS NOT NULL
GROUP BY category
ORDER BY category;
