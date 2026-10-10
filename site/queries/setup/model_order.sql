-- One row per model: its number of top-level requests over every week and scope, largest first; the order that fixes each model's colour.
SELECT model,
       count(*) AS requests
FROM requests
WHERE is_top_level
GROUP BY model
ORDER BY requests DESC, model;
