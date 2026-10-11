-- One row per week: its top-level requests of the selected harnesses, and their input tokens in three parts; every week, whatever weeks are selected.
-- A top-level session is one no other session spawned, so it has no parent; its totals are over its own requests.
-- cached_tokens are the cache reads; uncached_tokens the rest of the input of the requests whose provider reports
-- cache reads (reported_input_tokens); unreported_tokens the input of the requests that report none.
-- The sums come from the sessions, not the requests: over every week they read under 1 MB instead of about 10.
SELECT week,
       sum(requests) AS requests,
       sum(cached_tokens) AS cached_tokens,
       sum(reported_input_tokens) - sum(cached_tokens) AS uncached_tokens,
       sum(input_tokens) - sum(reported_input_tokens) AS unreported_tokens
FROM sessions
WHERE parent_session_id IS NULL
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY week
ORDER BY week;
