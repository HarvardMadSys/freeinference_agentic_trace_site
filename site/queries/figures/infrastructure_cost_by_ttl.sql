-- One row per part and TTL up to a day of what an inference provider pays in the cache simulation of the paper's
-- harnesses (`Agentic`) under the TTL-only policy, over its tallies in the selected weeks it covers, whatever harnesses
-- are selected, at the pipeline's prices below: the TTL (`1s` to `1d`) and `ttl_seconds`; the `part`, `recompute` (the
-- missed tokens prefilled again, at the recompute price) or `storage` (the reusable and dead token-seconds kept in
-- memory, at the price of a token kept for a day); `cost_multiple`, the part's cost over the total of the two at a
-- one-minute TTL; `total_multiple`, the TTL's two parts together, over the same; `is_lowest`, whether the TTL's total
-- is the lowest of every TTL, `none` included (on a tie, the shortest); and `rows`, the top-level requests of the
-- paper's harnesses the simulation replayed in those weeks. Tokens and token-seconds are summed over the weeks first.
-- The TTL `none` has no row, as the paper's axis ends at a day. The rows come by part, then in TTL order.
WITH constants AS (
  SELECT 1.0 AS recompute_price, -- the pipeline's prices.RECOMPUTE_PRICE: $ per million missed tokens prefilled again
         30.0 AS storage_price_per_day, -- prices.STORAGE_PRICE_PER_DAY: $ per million tokens kept in memory for a day
         1000000 AS tokens_per_million, -- prices.TOKENS_PER_MILLION: the prices are per million tokens
         86400 AS seconds_per_day, -- prices.SECONDS_PER_DAY: token-seconds over this are token-days
         '1m' AS normalising_ttl -- cache_costs.NORMALISING_TTL: costs are a multiple of their total at this TTL
),
ttls (ttl, ttl_seconds) AS (
  VALUES ('1s', 1),
         ('10s', 10),
         ('30s', 30),
         ('1m', 60),
         ('5m', 300),
         ('10m', 600),
         ('15m', 900),
         ('30m', 1800),
         ('1h', 3600),
         ('3h', 10800),
         ('6h', 21600),
         ('1d', 86400),
         ('none', 'infinity'::DOUBLE)
),
simulated_tallies AS (
  SELECT week, ttl, miss_tokens, reusable_token_seconds, dead_token_seconds
  FROM simulation
  WHERE scope = 'Agentic'
    AND week IN (SELECT week FROM selected_weeks)
),
replayed_requests AS (
  SELECT count(*) AS rows
  FROM requests
  WHERE is_top_level
    AND harness NOT IN (SELECT harness FROM benchmark_harness)
    AND week IN (SELECT week FROM simulated_tallies)
),
ttl_tallies AS (
  SELECT ttl,
         sum(miss_tokens) AS miss_tokens,
         sum(reusable_token_seconds) + sum(dead_token_seconds) AS retained_token_seconds
  FROM simulated_tallies
  GROUP BY ttl
),
ttl_costs AS (
  SELECT ttl_tallies.ttl,
         ttls.ttl_seconds,
         ttl_tallies.miss_tokens * constants.recompute_price / constants.tokens_per_million AS recompute,
         ttl_tallies.retained_token_seconds / constants.seconds_per_day * constants.storage_price_per_day
           / constants.tokens_per_million AS storage
  FROM ttl_tallies
  JOIN ttls ON ttl_tallies.ttl = ttls.ttl
  CROSS JOIN constants
),
minute_total AS (
  SELECT ttl_costs.recompute + ttl_costs.storage AS total
  FROM ttl_costs, constants
  WHERE ttl_costs.ttl = constants.normalising_ttl
),
multiples AS (
  SELECT ttl_costs.ttl,
         ttl_costs.ttl_seconds,
         ttl_costs.recompute / minute_total.total AS recompute,
         ttl_costs.storage / minute_total.total AS storage,
         (ttl_costs.recompute + ttl_costs.storage) / minute_total.total AS total
  FROM ttl_costs, minute_total
),
lowest AS (
  SELECT ttl
  FROM multiples
  ORDER BY total, ttl_seconds
  LIMIT 1
),
parts AS (
  SELECT ttl, ttl_seconds, 'recompute' AS part, recompute AS cost_multiple, total FROM multiples
  UNION ALL
  SELECT ttl, ttl_seconds, 'storage' AS part, storage AS cost_multiple, total FROM multiples
)
SELECT parts.ttl,
       parts.ttl_seconds,
       parts.part,
       parts.cost_multiple,
       parts.total AS total_multiple,
       parts.ttl IN (SELECT ttl FROM lowest) AS is_lowest,
       replayed_requests.rows
FROM parts
CROSS JOIN replayed_requests
WHERE parts.ttl <> 'none'
ORDER BY parts.part, parts.ttl_seconds;
