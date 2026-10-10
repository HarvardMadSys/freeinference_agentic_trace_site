-- One row per model: the number of top-level requests in the selected weeks and scope sent to it, largest first.
SELECT model,
       count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes)
GROUP BY model
ORDER BY requests DESC, model;
