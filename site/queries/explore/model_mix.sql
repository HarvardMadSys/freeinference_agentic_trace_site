-- One row per model: the number of top-level requests in the selected weeks and harnesses sent to it, largest first.
SELECT model,
       count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY model
ORDER BY requests DESC, model;
