-- One row per scope and CDF point of turn durations: the human-driven scope is the top-level sessions of the selected
-- weeks and harnesses but the benchmark's, the benchmark scope the top-level sessions of the benchmark harness in the
-- selected weeks, whatever harnesses are selected. A turn's duration is its last request's end minus its first
-- request's start. Per row: `series` (`Agentic`, human-driven, or `SWE-Bench`, the benchmark, the pipeline's scope
-- names), the duration `x` in seconds at which the share `share` of the scope's turns is reached, and, the same on
-- every row of a scope, `rows` (its turns) and `median` (its median duration); `median_ratio`, the same on every row,
-- is the larger median over the smaller, and missing unless both scopes have turns. Each scope has 201 points, `share`
-- running evenly from 0 to 1 in steps of 1/200.
WITH scoped_requests AS (
  SELECT week,
         session_id,
         turn,
         start_ms,
         end_ms,
         CASE WHEN harness IN (SELECT harness FROM benchmark_harness) THEN 'SWE-Bench' ELSE 'Agentic' END AS series
  FROM requests
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND (harness IN (SELECT harness FROM selected_harnesses) OR harness IN (SELECT harness FROM benchmark_harness))
),
turn_durations AS (
  SELECT series,
         (max(end_ms) - min(start_ms)) / 1000 AS seconds -- 1000 milliseconds to the second
  FROM scoped_requests
  GROUP BY series, week, session_id, turn
),
quantiles AS (
  SELECT series,
         count(seconds) AS rows,
         quantile_cont(seconds, 0.5) AS median,
         quantile_cont(seconds, [i / 200 for i in range(201)]) AS points
  FROM turn_durations
  GROUP BY series
),
median_ratio AS (
  SELECT CASE WHEN count(*) = 2 THEN max(median) / min(median) END AS median_ratio
  FROM quantiles
)
SELECT quantiles.series,
       unnest(quantiles.points) AS x,
       unnest([i / 200 for i in range(201)]) AS share,
       quantiles.rows,
       quantiles.median,
       median_ratio.median_ratio
FROM quantiles, median_ratio
ORDER BY quantiles.series, share;
