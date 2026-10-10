-- One row per power-of-two bin of requests per session: where it starts and ends, and how many top-level sessions of the selected weeks and scope fall in it.
-- The bins double in width (base 2): a value v above 0 falls in [2^floor(log2 v), 2^(floor(log2 v) + 1)); a value of 0 in [0, 1).
-- A top-level session is one no other session spawned, so it has no parent.
WITH binned AS (
    SELECT CASE WHEN requests = 0 THEN 0 ELSE power(2, floor(log2(requests))) END AS bin_start
    FROM sessions
    WHERE parent_session_id IS NULL
      AND week IN (SELECT week FROM selected_weeks)
      AND scope IN (SELECT scope FROM selected_scopes)
)
SELECT bin_start,
       CASE WHEN bin_start = 0 THEN 1 ELSE 2 * bin_start END AS bin_end,
       count(*) AS rows
FROM binned
GROUP BY bin_start
ORDER BY bin_start;
