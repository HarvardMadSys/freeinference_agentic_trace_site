-- One row per week and model: the number of top-level requests of the selected harnesses sent to that model in that week; every week, whatever weeks are selected.
SELECT week,
       model,
       count(*) AS requests
FROM requests
WHERE is_top_level
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY week, model
ORDER BY week, requests DESC, model;
