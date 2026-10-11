-- One row per model, over the top-level requests of the selected weeks and harnesses with a trusted TTFT: the model, its
-- `rows` (those requests) and their `median_decode_s`, the median of the latency minus the TTFT in seconds. Most
-- requests first. No page draws it: the paper-parity test compares the median of each model the paper decomposes with
-- the paper's, whether or not `decode_cdf_by_model` draws that model.
SELECT model,
       count(*) AS rows,
       median((end_ms - start_ms - ttft_ms) / 1000) AS median_decode_s -- 1000 milliseconds to the second
FROM requests
WHERE is_top_level
  AND is_trusted_ttft
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY model
ORDER BY rows DESC, model;
