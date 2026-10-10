-- One row per transition (`append`, `mutation` or `switch`: how the request's context changed from the one before
-- it), over the top-level requests of the selected weeks and scope that have one and a hit ratio: the transition,
-- its `rows` (requests) and their `mean_hit_ratio`.
SELECT transition,
       count(*) AS rows,
       avg(hit_ratio) AS mean_hit_ratio
FROM requests
WHERE is_top_level
  AND transition IS NOT NULL
  AND hit_ratio IS NOT NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes)
GROUP BY transition
ORDER BY transition;
