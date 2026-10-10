-- One row: how many top-level requests of the selected weeks and scope there are, and the largest and the exact 50th, 75th, 90th and 95th percentiles of their uncached input tokens per request.
-- A request whose provider reports no cache reads has no uncached tokens and is left out.
SELECT count(uncached_tokens) AS count,
       max(uncached_tokens) AS max,
       quantile_cont(uncached_tokens, 0.5) AS p50,
       quantile_cont(uncached_tokens, 0.75) AS p75,
       quantile_cont(uncached_tokens, 0.9) AS p90,
       quantile_cont(uncached_tokens, 0.95) AS p95
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes)
  AND uncached_tokens IS NOT NULL;
