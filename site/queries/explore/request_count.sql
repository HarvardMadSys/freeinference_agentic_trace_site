-- The number of requests of the top-level sessions in the selected weeks and scope.
SELECT count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes);
