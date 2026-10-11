-- One row per provider and idle-gap bin, over the top-level requests of the selected weeks and harnesses with an idle gap
-- of at most an hour: the provider, `idle_gap_bin` (the bin's index, 0 to 25, among the pipeline's 26 geometric
-- idle-gap bins from 10 s to 1 h; a gap under 10 s counts in bin 0), the bin's `rows` (requests) and their
-- `median_hit_ratio`. A request has an idle gap only where the pipeline measured one, so it also has a hit ratio.
SELECT provider,
       idle_gap_bin,
       count(*) AS rows,
       median(hit_ratio) AS median_hit_ratio
FROM requests
WHERE is_top_level
  AND idle_gap_bin IS NOT NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
GROUP BY provider, idle_gap_bin
ORDER BY provider, idle_gap_bin;
