-- One row per series and CDF point over the top-level requests of the selected weeks and harnesses with a trusted TTFT:
-- the series is one of the five models with most requests in the selection, `x` the TTFT in seconds at which the
-- share `share` of the model's trusted TTFTs is reached, and `rows` the model's requests with a trusted TTFT. Each
-- series has 201 points, `share` running evenly from 0 to 1 in steps of 1/200.
WITH selected_requests AS (
  SELECT model, ttft_ms, is_trusted_ttft
  FROM requests
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
largest_models AS (
  SELECT model
  FROM selected_requests
  GROUP BY model
  ORDER BY count(*) DESC, model
  LIMIT 5 -- the five models with most requests
),
series_values AS (
  SELECT model AS series, ttft_ms / 1000 AS value -- 1000 milliseconds to the second
  FROM selected_requests
  WHERE is_trusted_ttft
    AND model IN (SELECT model FROM largest_models)
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
