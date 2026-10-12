-- One row per part and TTL up to a day of what an API customer pays in the cache simulation of the paper's harnesses
-- (`Agentic`) under the TTL-only policy, over its tallies in the selected weeks it covers, whatever harnesses are
-- selected, at the pipeline's prices below: the TTL (`1s` to `1d`) and `ttl_seconds`; the `part`, `input` (the missed
-- tokens at the uncached price), `cache_read` (the hit tokens at the cached price) or `output` (the output tokens at the
-- output price); `cost_multiple`, the part's cost over the total of the three at a one-minute TTL; `total_multiple`,
-- the TTL's three parts together, over the same; `is_knee`, whether the TTL is the knee, the shortest TTL whose total
-- is within 5% of the lowest total of every TTL, `none` included; and `rows`, the top-level requests of the paper's
-- harnesses the simulation replayed in those weeks. Tokens are summed over the weeks first; a week's output tokens
-- repeat on each of its tally rows, so they are summed once per week. The TTL `none` has no row, as the paper's axis
-- ends at a day. The rows come by part, then in TTL order.
WITH constants AS (
  SELECT 1.0 AS cached_price, -- the pipeline's prices.CACHED_PRICE: a cached input token
         10.0 AS uncached_price, -- prices.UNCACHED_PRICE: an uncached input token
         50.0 AS output_price, -- prices.OUTPUT_PRICE: an output token
         1000000 AS tokens_per_million, -- prices.TOKENS_PER_MILLION: the prices are per million tokens
         '1m' AS normalising_ttl, -- cache_costs.NORMALISING_TTL: costs are a multiple of their total at this TTL
         0.05 AS knee_tolerance -- cache_costs.KNEE_TOLERANCE: the knee's total is within this share of the lowest
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
  SELECT week, ttl, hit_tokens, miss_tokens, output_tokens
  FROM simulation
  WHERE scope = 'Agentic'
    AND week IN (SELECT week FROM selected_weeks)
),
week_outputs AS (
  SELECT week, any_value(output_tokens) AS output_tokens
  FROM simulated_tallies
  GROUP BY week
),
scope_output AS (
  SELECT sum(output_tokens) AS output_tokens
  FROM week_outputs
),
replayed_requests AS (
  SELECT count(*) AS rows
  FROM requests
  WHERE is_top_level
    AND harness NOT IN (SELECT harness FROM benchmark_harness)
    AND week IN (SELECT week FROM week_outputs)
),
ttl_tallies AS (
  SELECT ttl, sum(hit_tokens) AS hit_tokens, sum(miss_tokens) AS miss_tokens
  FROM simulated_tallies
  GROUP BY ttl
),
ttl_costs AS (
  SELECT ttl_tallies.ttl,
         ttls.ttl_seconds,
         ttl_tallies.miss_tokens * constants.uncached_price / constants.tokens_per_million AS input,
         ttl_tallies.hit_tokens * constants.cached_price / constants.tokens_per_million AS cache_read,
         scope_output.output_tokens * constants.output_price / constants.tokens_per_million AS output
  FROM ttl_tallies
  JOIN ttls ON ttl_tallies.ttl = ttls.ttl
  CROSS JOIN scope_output
  CROSS JOIN constants
),
minute_total AS (
  SELECT ttl_costs.input + ttl_costs.cache_read + ttl_costs.output AS total
  FROM ttl_costs, constants
  WHERE ttl_costs.ttl = constants.normalising_ttl
),
multiples AS (
  SELECT ttl_costs.ttl,
         ttl_costs.ttl_seconds,
         ttl_costs.input / minute_total.total AS input,
         ttl_costs.cache_read / minute_total.total AS cache_read,
         ttl_costs.output / minute_total.total AS output,
         (ttl_costs.input + ttl_costs.cache_read + ttl_costs.output) / minute_total.total AS total
  FROM ttl_costs, minute_total
),
knee AS (
  SELECT multiples.ttl
  FROM multiples, constants
  WHERE multiples.total <= (SELECT min(total) FROM multiples) * (1 + constants.knee_tolerance)
  ORDER BY multiples.ttl_seconds
  LIMIT 1
),
parts AS (
  SELECT ttl, ttl_seconds, 'input' AS part, input AS cost_multiple, total FROM multiples
  UNION ALL
  SELECT ttl, ttl_seconds, 'cache_read' AS part, cache_read AS cost_multiple, total FROM multiples
  UNION ALL
  SELECT ttl, ttl_seconds, 'output' AS part, output AS cost_multiple, total FROM multiples
)
SELECT parts.ttl,
       parts.ttl_seconds,
       parts.part,
       parts.cost_multiple,
       parts.total AS total_multiple,
       parts.ttl IN (SELECT ttl FROM knee) AS is_knee,
       replayed_requests.rows
FROM parts
CROSS JOIN replayed_requests
WHERE parts.ttl <> 'none'
ORDER BY parts.part, parts.ttl_seconds;
