-- One row per tool category, over the tool calls of the top-level sessions of the selected weeks and scope: the
-- category, its `rows` (calls) and `share_of_calls` of all those calls, the `sessions` that called it, its
-- `failed_share` (calls whose outcome is error, denied or timeout, over its calls with an outcome; null when none has
-- one), the `median_latency_ms` of its calls that were their request's only call (a batch's calls share one wait),
-- and its `median_result_tokens`. Most calls first.
WITH selected_calls AS (
  SELECT session_id,
         category,
         outcome,
         latency_ms,
         result_tokens,
         count(*) OVER (PARTITION BY week, session_id, step) AS calls_of_its_request
  FROM tool_calls
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
)
SELECT category,
       count(*) AS rows,
       count(*) / sum(count(*)) OVER () AS share_of_calls,
       count(DISTINCT session_id) AS sessions,
       count(*) FILTER (WHERE outcome IN ('error', 'denied', 'timeout')) / nullif(count(outcome), 0) AS failed_share,
       median(latency_ms) FILTER (WHERE calls_of_its_request = 1) AS median_latency_ms,
       median(result_tokens) AS median_result_tokens
FROM selected_calls
GROUP BY category
ORDER BY rows DESC, category;
