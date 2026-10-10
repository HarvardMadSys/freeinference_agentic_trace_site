-- One row per series and CDF point over the top-level sessions of the selected weeks and scope: the series
-- `requests`, `user_steps` or `tool_steps`, the count `x` at which the share `share` of sessions is reached, and the
-- series' `rows` (sessions). Each series has 201 points, `share` running evenly from 0 to 1 in steps of 1/200.
WITH selected_sessions AS (
  SELECT requests, user_steps, tool_steps
  FROM sessions
  WHERE parent_session_id IS NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
),
series_values AS (
  SELECT 'requests' AS series, requests AS value FROM selected_sessions
  UNION ALL
  SELECT 'user_steps' AS series, user_steps AS value FROM selected_sessions
  UNION ALL
  SELECT 'tool_steps' AS series, tool_steps AS value FROM selected_sessions
),
quantiles AS (
  SELECT series,
         count(value) AS rows,
         quantile_cont(value, [i / 200 for i in range(201)]) AS points
  FROM series_values
  GROUP BY series
)
SELECT series,
       unnest(points) AS x,
       unnest([i / 200 for i in range(201)]) AS share,
       rows
FROM quantiles
ORDER BY series, share;
