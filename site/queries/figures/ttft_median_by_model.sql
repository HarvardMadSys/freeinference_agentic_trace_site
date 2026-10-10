-- One row per model, over the top-level requests of the selected weeks and scope with a trusted TTFT: the model, its
-- `rows` (those requests) and their `median_ttft_s`, the median TTFT in seconds. Most requests first. No page draws
-- it: the paper-parity test compares each model's median with the paper's, and tests/test_figure_queries.py checks it.
SELECT model,
       count(*) AS rows,
       median(ttft_ms / 1000) AS median_ttft_s -- 1000 milliseconds to the second
FROM requests
WHERE is_top_level
  AND is_trusted_ttft
  AND week IN (SELECT week FROM selected_weeks)
  AND scope IN (SELECT scope FROM selected_scopes)
GROUP BY model
ORDER BY rows DESC, model;
