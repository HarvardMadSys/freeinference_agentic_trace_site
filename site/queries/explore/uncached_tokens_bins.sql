-- One row per power-of-two bin of uncached input tokens per request: where it starts and ends, and how many top-level requests of the selected weeks and harnesses fall in it.
-- The bins double in width (base 2): a value v above 0 falls in [2^floor(log2 v), 2^(floor(log2 v) + 1)); a value of 0 in [0, 1).
-- A request whose provider reports no cache reads has no uncached tokens and is left out.
WITH binned AS (
    SELECT CASE WHEN uncached_tokens = 0 THEN 0 ELSE power(2, floor(log2(uncached_tokens))) END AS bin_start
    FROM requests
    WHERE is_top_level
      AND week IN (SELECT week FROM selected_weeks)
      AND harness IN (SELECT harness FROM selected_harnesses)
      AND uncached_tokens IS NOT NULL
)
SELECT bin_start,
       CASE WHEN bin_start = 0 THEN 1 ELSE 2 * bin_start END AS bin_end,
       count(*) AS rows
FROM binned
GROUP BY bin_start
ORDER BY bin_start;
