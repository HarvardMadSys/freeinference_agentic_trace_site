-- One row per number of tool calls a request emitted, over the top-level requests of the selected weeks and harnesses
-- that emitted at least one: `tool_calls` ('1' to '8', and '9+' for nine or more together), its `rows` (requests)
-- and their `share` of those requests. Fewest calls first.
WITH emitting_requests AS (
  SELECT least(n_tool_calls, 9) AS calls_counted -- nine or more calls are counted together, as 9
  FROM requests
  WHERE is_top_level
    AND n_tool_calls >= 1
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
)
SELECT CASE WHEN calls_counted = 9 THEN '9+' ELSE CAST(calls_counted AS VARCHAR) END AS tool_calls,
       count(*) AS rows,
       count(*) / sum(count(*)) OVER () AS share
FROM emitting_requests
GROUP BY calls_counted
ORDER BY calls_counted;
