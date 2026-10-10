-- One row per eviction policy and TTL of the cache simulation, over its Agentic tallies in the selected weeks it
-- covers, whatever scope is selected (the simulation was run for the Agentic scope only): the policy, the TTL (`1s`
-- to `1d`, or `none`), its `hit_ratio` (hit tokens over hit and missed tokens, each summed over the weeks), and
-- `rows`, the top-level Agentic requests the simulation replayed in those weeks.
WITH simulated_tallies AS (
  SELECT week, policy, ttl, hit_tokens, miss_tokens
  FROM simulation
  WHERE scope = 'Agentic'
    AND week IN (SELECT week FROM selected_weeks)
),
replayed_requests AS (
  SELECT count(*) AS rows
  FROM requests
  WHERE is_top_level
    AND scope = 'Agentic'
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
