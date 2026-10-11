-- One row per harness: its number of top-level sessions over every week, whatever the selection, largest first; the order that fixes each harness's colour.
-- A top-level session is one no other session spawned, so it has no parent.
SELECT harness,
       count(*) AS sessions
FROM sessions
WHERE parent_session_id IS NULL
GROUP BY harness
ORDER BY sessions DESC, harness;
