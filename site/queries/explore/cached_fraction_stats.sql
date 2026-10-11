-- One row: how many top-level requests of the selected weeks and harnesses have a cached fraction, and the largest and the exact 50th, 75th, 90th and 95th percentiles of it.
-- A request whose provider reports no cache reads, or with no input, has no cached fraction and is left out.
SELECT count(hit_ratio) AS count,
       max(hit_ratio) AS max,
       quantile_cont(hit_ratio, 0.5) AS p50,
       quantile_cont(hit_ratio, 0.75) AS p75,
       quantile_cont(hit_ratio, 0.9) AS p90,
       quantile_cont(hit_ratio, 0.95) AS p95
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
  AND hit_ratio IS NOT NULL;
