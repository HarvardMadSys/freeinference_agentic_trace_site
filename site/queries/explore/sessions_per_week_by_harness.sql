-- One row per week and selected harness: the number of top-level sessions of that harness in that week; every week, whatever weeks are selected.
-- A top-level session is one no other session spawned, so it has no parent.
SELECT week,
       harness,
       count(*) AS sessions
FROM sessions
WHERE parent_session_id IS NULL
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY week, harness
ORDER BY week, sessions DESC, harness;
