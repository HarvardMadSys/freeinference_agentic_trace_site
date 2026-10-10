-- One row per series and CDF point over the top-level requests of the selected weeks and scope: the series `input`
-- (input tokens), `uncached` (uncached input tokens, where the provider reports cache reads) or `output` (output
-- tokens, where there are more than one, as the paper counts them), the token count `x` at which the share `share`
-- of the series is reached, and the series' `rows` (requests). Each series has 201 points, `share` running evenly
-- from 0 to 1 in steps of 1/200.
WITH selected_requests AS (
  SELECT prompt_tokens, uncached_tokens, completion_tokens
  FROM requests
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
),
series_values AS (
  SELECT 'input' AS series, prompt_tokens AS value FROM selected_requests WHERE prompt_tokens IS NOT NULL
  UNION ALL
  SELECT 'uncached' AS series, uncached_tokens AS value FROM selected_requests WHERE uncached_tokens IS NOT NULL
  UNION ALL
  SELECT 'output' AS series, completion_tokens AS value FROM selected_requests WHERE completion_tokens > 1
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
