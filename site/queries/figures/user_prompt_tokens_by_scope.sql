-- One row per scope and CDF point of the tokens of a user's new prompt: the human-driven scope is the top-level
-- requests of the selected weeks and harnesses but the benchmark's, the benchmark scope the top-level requests of the
-- benchmark harness in the selected weeks, whatever harnesses are selected. A user step's new prompt is the pipeline's
-- `user_prompt_tokens`, which the data step computes; a tool step, and a user step whose user tokens did not rise, has
-- none and is left out. Per row: `series` (`Agentic`, human-driven, or `SWE-Bench`, the benchmark, the pipeline's scope
-- names), the token count `x` at which the share `share` of the scope's prompts is reached, and, the same on every row
-- of a scope, `rows` (its prompts) and `median` (its median prompt); `median_ratio`, the same on every row, is the
-- larger median over the smaller, and missing unless both scopes have prompts. Each scope has 201 points, `share`
-- running evenly from 0 to 1 in steps of 1/200.
WITH user_prompts AS (
  SELECT CASE WHEN harness IN (SELECT harness FROM benchmark_harness) THEN 'SWE-Bench' ELSE 'Agentic' END AS series,
         user_prompt_tokens AS tokens
  FROM requests
  WHERE is_top_level
    AND user_prompt_tokens IS NOT NULL
    AND week IN (SELECT week FROM selected_weeks)
    AND (harness IN (SELECT harness FROM selected_harnesses) OR harness IN (SELECT harness FROM benchmark_harness))
),
quantiles AS (
  SELECT series,
         count(tokens) AS rows,
         quantile_cont(tokens, 0.5) AS median,
         quantile_cont(tokens, [i / 200 for i in range(201)]) AS points
  FROM user_prompts
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
