-- The number of requests of the top-level sessions in the selected weeks and harnesses. No page runs it: it is the
-- example query of CONTRIBUTING.md, and tests/test_queries.py checks the count against the fixture.
SELECT count(*) AS requests
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
