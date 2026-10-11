-- One row: how many top-level requests of the selected weeks and harnesses there are, and the largest and the exact 50th, 75th, 90th and 95th percentiles of their input tokens per request.
SELECT count(prompt_tokens) AS count,
       max(prompt_tokens) AS max,
       quantile_cont(prompt_tokens, 0.5) AS p50,
       quantile_cont(prompt_tokens, 0.75) AS p75,
       quantile_cont(prompt_tokens, 0.9) AS p90,
       quantile_cont(prompt_tokens, 0.95) AS p95
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses);
