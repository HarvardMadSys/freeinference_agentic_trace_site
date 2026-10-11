-- One row per TTL of the cache simulation's `ttl_only` policy, over its tallies in the selected weeks it covers,
-- whatever harnesses are selected (the simulation replays the paper's population, every harness but the benchmark):
-- the TTL (`1s` to `1d`, or `none`), its `reusable_over_active` (the token-seconds of cached blocks that are read again
-- over those of blocks held by requests in flight, each summed over the weeks), its `dead_over_active` (the same for
-- cached blocks never read again), and `rows`, the top-level requests of the paper's population the simulation
-- replayed in those weeks. A week's active token-seconds repeat on each of its tally rows, so they are summed once per
-- week.
WITH simulated_tallies AS (
  SELECT week, ttl, reusable_token_seconds, dead_token_seconds, active_token_seconds
  FROM simulation
  WHERE policy = 'ttl_only'
    AND week IN (SELECT week FROM selected_weeks)
),
replayed_requests AS (
  SELECT count(*) AS rows
  FROM requests
  WHERE is_top_level
    AND harness NOT IN (SELECT harness FROM benchmark_harness)
    AND week IN (SELECT week FROM simulated_tallies)
),
active AS (
  SELECT sum(active_token_seconds) AS active_token_seconds
  FROM (SELECT DISTINCT week, active_token_seconds FROM simulated_tallies)
),
ttl_tallies AS (
  SELECT ttl,
         sum(reusable_token_seconds) AS reusable_token_seconds,
         sum(dead_token_seconds) AS dead_token_seconds
  FROM simulated_tallies
  GROUP BY ttl
)
SELECT ttl_tallies.ttl,
       ttl_tallies.reusable_token_seconds / nullif(active.active_token_seconds, 0) AS reusable_over_active,
       ttl_tallies.dead_token_seconds / nullif(active.active_token_seconds, 0) AS dead_over_active,
       replayed_requests.rows
FROM ttl_tallies
CROSS JOIN active
CROSS JOIN replayed_requests
ORDER BY ttl_tallies.ttl;
