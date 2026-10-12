-- One row per scope and CDF point of the input tokens of a request: the human-driven scope is the top-level requests of
-- the selected weeks and harnesses but the benchmark's, the benchmark scope the top-level requests of the benchmark
-- harness in the selected weeks, whatever harnesses are selected; a request whose input is not reported is left out.
-- Per row: `series` (`Agentic`, human-driven, or `SWE-Bench`, the benchmark, the pipeline's scope names), the token
-- count `x` at which the share `share` of the scope's requests is reached, and, the same on every row of a scope,
-- `rows` (its requests) and `median` (its median input); `median_ratio`, the same on every row, is the larger median
-- over the smaller, and missing when the smaller is zero or unless both scopes have requests. Each scope has 201
-- points, `share` running evenly from 0 to 1 in steps of 1/200.
WITH request_inputs AS (
  SELECT CASE WHEN harness IN (SELECT harness FROM benchmark_harness) THEN 'SWE-Bench' ELSE 'Agentic' END AS series,
         prompt_tokens AS tokens
  FROM requests
  WHERE is_top_level
    AND prompt_tokens IS NOT NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND (harness IN (SELECT harness FROM selected_harnesses) OR harness IN (SELECT harness FROM benchmark_harness))
),
quantiles AS (
  SELECT series,
         count(tokens) AS rows,
         quantile_cont(tokens, 0.5) AS median,
         quantile_cont(tokens, [i / 200 for i in range(201)]) AS points
  FROM request_inputs
  GROUP BY series
),
median_ratio AS (
  SELECT CASE WHEN count(*) = 2 THEN max(median) / nullif(min(median), 0) END AS median_ratio -- none over a zero
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
