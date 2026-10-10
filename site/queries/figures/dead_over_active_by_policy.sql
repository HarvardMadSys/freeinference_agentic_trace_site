-- One row per eviction policy and TTL of the cache simulation, over its Agentic tallies in the selected weeks it
-- covers, whatever scope is selected (the simulation was run for the Agentic scope only): the policy, the TTL (`1s`
-- to `1d`, or `none`), its `dead_over_active` (the token-seconds of cached blocks never read again over those of
-- blocks held by requests in flight, each summed over the weeks), and `rows`, the top-level Agentic requests the
-- simulation replayed in those weeks. A week's active token-seconds repeat on each of its tally rows, so they are
-- summed once per week.
WITH simulated_tallies AS (
  SELECT week, policy, ttl, dead_token_seconds, active_token_seconds
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
active AS (
  SELECT sum(active_token_seconds) AS active_token_seconds
  FROM (SELECT DISTINCT week, active_token_seconds FROM simulated_tallies)
),
policy_tallies AS (
  SELECT policy,
         ttl,
         sum(dead_token_seconds) AS dead_token_seconds
  FROM simulated_tallies
  GROUP BY policy, ttl
)
SELECT policy_tallies.policy,
       policy_tallies.ttl,
       policy_tallies.dead_token_seconds / nullif(active.active_token_seconds, 0) AS dead_over_active,
       replayed_requests.rows
FROM policy_tallies
CROSS JOIN active
CROSS JOIN replayed_requests
ORDER BY policy, ttl;
