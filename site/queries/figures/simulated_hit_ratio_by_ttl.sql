-- One row per eviction policy and TTL of the cache simulation, over its tallies in the selected weeks it covers,
-- whatever harnesses are selected (the simulation replays the paper's population, every harness but the benchmark):
-- the policy, the TTL (`1s` to `1d`, or `none`), its `hit_ratio` (hit tokens over hit and missed tokens, each summed
-- over the weeks), and `rows`, the top-level requests of the paper's population the simulation replayed in those
-- weeks.
WITH simulated_tallies AS (
  SELECT week, policy, ttl, hit_tokens, miss_tokens
  FROM simulation
  WHERE week IN (SELECT week FROM selected_weeks)
),
replayed_requests AS (
  SELECT count(*) AS rows
  FROM requests
  WHERE is_top_level
    AND harness NOT IN (SELECT harness FROM benchmark_harness)
    AND week IN (SELECT week FROM simulated_tallies)
),
policy_tallies AS (
  SELECT policy,
         ttl,
         sum(hit_tokens) AS hit_tokens,
         sum(miss_tokens) AS miss_tokens
  FROM simulated_tallies
  GROUP BY policy, ttl
)
SELECT policy,
       ttl,
       hit_tokens / nullif(hit_tokens + miss_tokens, 0) AS hit_ratio,
       rows
FROM policy_tallies
CROSS JOIN replayed_requests
ORDER BY policy, ttl;
