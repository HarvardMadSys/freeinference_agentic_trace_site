-- One row per gap bin and CDF point over the top-level requests of the selected weeks and harnesses that have a gap
-- (a wait of 0 s or more since the previous request of their session ended, with what it waited for) and a hit ratio:
-- the series, which is the label of the gap's bin, the hit ratio `x` at which the share `share` of the series is
-- reached, and the series' `rows` (requests). A bin holds the gaps from its lower bound, included, to its upper bound,
-- in seconds. Each series has 201 points, `share` running evenly from 0 to 1 in steps of 1/200; the series come in the
-- order of their bins, shortest gap first.
WITH gap_bins (series, bin_order, lower_s, upper_s) AS (
  VALUES ('<1m', 1, 0, 60),
         ('1–5m', 2, 60, 300),
         ('5–15m', 3, 300, 900),
         ('15–30m', 4, 900, 1800),
         ('30m–1h', 5, 1800, 3600),
         ('>1h', 6, 3600, 'infinity'::DOUBLE)
),
gap_hit_ratios AS (
  SELECT gap_bins.series, gap_bins.bin_order, requests.hit_ratio
  FROM requests
  JOIN gap_bins ON requests.wait_s >= gap_bins.lower_s AND requests.wait_s < gap_bins.upper_s
  WHERE requests.is_top_level
    AND requests.waited_for IS NOT NULL
    AND requests.hit_ratio IS NOT NULL
    AND requests.week IN (SELECT week FROM selected_weeks)
    AND requests.harness IN (SELECT harness FROM selected_harnesses)
),
quantiles AS (
  SELECT series,
         bin_order,
         count(hit_ratio) AS rows,
         quantile_cont(hit_ratio, [i / 200 for i in range(201)]) AS points
  FROM gap_hit_ratios
  GROUP BY series, bin_order
)
SELECT series,
       unnest(points) AS x,
       unnest([i / 200 for i in range(201)]) AS share,
       rows
FROM quantiles
ORDER BY bin_order, share;
