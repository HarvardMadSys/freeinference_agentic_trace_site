-- One row per cause over the top-level requests of the selected weeks and harnesses that have a gap (a wait of 0 s or
-- more since the previous request of their session ended) and a hit ratio: what the gap waited for (`tool`,
-- `ask_user_tool`, `user` or `subagent`, in that order), its `rows` (requests) and their `mean_hit_ratio`.
WITH causes (waited_for, cause_order) AS (
  VALUES ('tool', 1),
         ('ask_user_tool', 2),
         ('user', 3),
         ('subagent', 4)
)
SELECT requests.waited_for,
       count(*) AS rows,
       avg(requests.hit_ratio) AS mean_hit_ratio
FROM requests
JOIN causes ON requests.waited_for = causes.waited_for
WHERE requests.is_top_level
  AND requests.wait_s >= 0
  AND requests.hit_ratio IS NOT NULL
  AND requests.week IN (SELECT week FROM selected_weeks)
  AND requests.harness IN (SELECT harness FROM selected_harnesses)
GROUP BY requests.waited_for, causes.cause_order
ORDER BY causes.cause_order;
