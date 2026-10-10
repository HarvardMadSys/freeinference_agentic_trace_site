-- One row per tool category, over the tool calls of the top-level sessions of the selected weeks and scope whose
-- result was matched (so its tokens are known): the category, its `rows` (those calls), and the 5th, 25th, 50th,
-- 75th and 95th percentile of their result tokens.
SELECT category,
       count(*) AS rows,
       quantile_cont(result_tokens, 0.05) AS p5,
       quantile_cont(result_tokens, 0.25) AS p25,
       quantile_cont(result_tokens, 0.50) AS p50,
       quantile_cont(result_tokens, 0.75) AS p75,
       quantile_cont(result_tokens, 0.95) AS p95
FROM tool_calls
WHERE is_top_level
  AND result_tokens IS NOT NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes)
GROUP BY category
ORDER BY category;
