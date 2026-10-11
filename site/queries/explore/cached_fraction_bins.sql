-- One row per bin of the cached fraction of a request: where it starts and ends, and how many top-level requests of the selected weeks and harnesses fall in it.
-- 20 bins of width 0.05 from 0 to 1; a fraction of exactly 1 is counted in the last bin, [0.95, 1].
-- A request whose provider reports no cache reads, or with no input, has no cached fraction and is left out.
WITH binned AS (
    SELECT least(floor(hit_ratio * 20), 19) AS bin_index
    FROM requests
    WHERE is_top_level
      AND week IN (SELECT week FROM selected_weeks)
      AND harness IN (SELECT harness FROM selected_harnesses)
      AND hit_ratio IS NOT NULL
)
SELECT bin_index / 20 AS bin_start,
       (bin_index + 1) / 20 AS bin_end,
       count(*) AS rows
FROM binned
GROUP BY bin_index
ORDER BY bin_index;
