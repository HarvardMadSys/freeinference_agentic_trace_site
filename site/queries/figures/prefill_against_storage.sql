-- One row per simulated population and TTL of the cache simulation's TTL-only policy, over its tallies in the selected
-- weeks it covers, whatever harnesses are selected: `scope`, the simulation's name of the population (`Agentic`, the
-- paper's harnesses, or `SWE-Bench`, the benchmark replay, each replayed on its own); the TTL (`1s` to `1d`, or `none`);
-- `normalised_prefill`, its missed tokens over those the population misses with no TTL; `mean_retained_tokens`, its
-- reusable and dead token-seconds over the population's span (each week's first arrival to last completion); and
-- `rows`, the top-level requests of the population the simulation replayed in those weeks. Tokens, token-seconds and
-- spans are each summed over the weeks first; a week's span repeats on each of its tally rows, so it is summed once per
-- week. The rows come by population, then in TTL order, shortest first and `none` last.
WITH ttls (ttl, ttl_seconds) AS (
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
  SELECT week, scope, ttl, miss_tokens, reusable_token_seconds, dead_token_seconds, span_seconds
  FROM simulation
  WHERE week IN (SELECT week FROM selected_weeks)
),
week_spans AS (
  SELECT week, scope, any_value(span_seconds) AS span_seconds
  FROM simulated_tallies
  GROUP BY week, scope
),
scope_spans AS (
  SELECT scope, sum(span_seconds) AS span_seconds
  FROM week_spans
  GROUP BY scope
),
ttl_tallies AS (
  SELECT scope,
         ttl,
         sum(miss_tokens) AS miss_tokens,
         sum(reusable_token_seconds) + sum(dead_token_seconds) AS retained_token_seconds
  FROM simulated_tallies
  GROUP BY scope, ttl
),
no_ttl_misses AS (
  SELECT scope, miss_tokens AS no_ttl_miss_tokens
  FROM ttl_tallies
  WHERE ttl = 'none'
),
request_scopes AS (
  SELECT week,
         CASE WHEN harness IN (SELECT harness FROM benchmark_harness) THEN 'SWE-Bench' ELSE 'Agentic' END AS scope
  FROM requests
  WHERE is_top_level
),
replayed_requests AS (
  SELECT request_scopes.scope, count(*) AS rows
  FROM request_scopes
  JOIN week_spans ON request_scopes.week = week_spans.week AND request_scopes.scope = week_spans.scope
  GROUP BY request_scopes.scope
)
SELECT ttl_tallies.scope,
       ttl_tallies.ttl,
       ttl_tallies.miss_tokens / nullif(no_ttl_misses.no_ttl_miss_tokens, 0) AS normalised_prefill,
       ttl_tallies.retained_token_seconds / nullif(scope_spans.span_seconds, 0) AS mean_retained_tokens,
       replayed_requests.rows
FROM ttl_tallies
JOIN ttls ON ttl_tallies.ttl = ttls.ttl
JOIN no_ttl_misses ON ttl_tallies.scope = no_ttl_misses.scope
JOIN scope_spans ON ttl_tallies.scope = scope_spans.scope
JOIN replayed_requests ON ttl_tallies.scope = replayed_requests.scope
ORDER BY ttl_tallies.scope, ttls.ttl_seconds;
