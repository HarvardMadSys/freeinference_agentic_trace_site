-- One row per transition and CDF point over the top-level requests of the selected weeks and harnesses that append
-- to the context before them (`append`) or rewrite it (`mutation`) and have a hit ratio: the series, which is the
-- transition, the hit ratio `x` at which the share `share` of the series is reached, and the series' `rows`
-- (requests). A request that went to another model or provider (`switch`) is left out. Each series has 201 points,
-- `share` running evenly from 0 to 1 in steps of 1/200.
WITH transition_hit_ratios AS (
  SELECT transition AS series, hit_ratio
  FROM requests
  WHERE is_top_level
    AND transition IN ('append', 'mutation')
    AND hit_ratio IS NOT NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
quantiles AS (
  SELECT series,
         count(hit_ratio) AS rows,
         quantile_cont(hit_ratio, [i / 200 for i in range(201)]) AS points
  FROM transition_hit_ratios
  GROUP BY series
)
SELECT series,
       unnest(points) AS x,
       unnest([i / 200 for i in range(201)]) AS share,
       rows
FROM quantiles
ORDER BY series, share;
