-- One row per model, with its top-level requests over every week and scope, largest first (ties by name):
-- the global order that gives each model the same colour on every chart, whatever the selection.
SELECT model,
       count(*) AS requests
FROM requests
WHERE is_top_level
GROUP BY model
ORDER BY requests DESC, model;
