-- One row per series and CDF point over the top-level sessions of the selected weeks and harnesses: the series `turn`
-- (a turn's duration: its last request's end minus its first request's start) or `session` (the session's duration),
-- the duration `x` in seconds at which the share `share` of the series is reached, and the series' `rows` (turns or
-- sessions). Each series has 201 points, `share` running evenly from 0 to 1 in steps of 1/200.
WITH turn_durations AS (
  SELECT (max(end_ms) - min(start_ms)) / 1000 AS seconds -- 1000 milliseconds to the second
  FROM requests
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
  GROUP BY week, session_id, turn
),
session_durations AS (
  SELECT duration_s AS seconds
  FROM sessions
  WHERE parent_session_id IS NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
series_values AS (
  SELECT 'turn' AS series, seconds AS value FROM turn_durations
  UNION ALL
  SELECT 'session' AS series, seconds AS value FROM session_durations
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
