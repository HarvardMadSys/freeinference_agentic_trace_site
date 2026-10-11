-- One row per cause and CDF point over the top-level requests of the selected weeks and harnesses that have a gap (a
-- wait of 0 s or more since the previous request of their session ended): the series, which is what the gap waited
-- for (`tool`, `ask_user_tool`, `user` or `subagent`), the gap `x` in seconds at which the share `share` of the series
-- is reached, and the series' `rows` (requests). Each series has 201 points, `share` running evenly from 0 to 1 in
-- steps of 1/200.
WITH gaps AS (
  SELECT waited_for AS series, wait_s
  FROM requests
  WHERE is_top_level
    AND wait_s >= 0
    AND waited_for IS NOT NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
quantiles AS (
  SELECT series,
         count(wait_s) AS rows,
         quantile_cont(wait_s, [i / 200 for i in range(201)]) AS points
  FROM gaps
  GROUP BY series
)
SELECT series,
       unnest(points) AS x,
       unnest([i / 200 for i in range(201)]) AS share,
       rows
FROM quantiles
ORDER BY series, share;
