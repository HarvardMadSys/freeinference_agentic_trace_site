-- One row per rank bin of the top-level sessions of the selected weeks and harnesses with any cost, a session's cost
-- counted over its requests whose provider reports cache reads and that have an input, at the prices below: the
-- sessions, each split into the shares of its cost that are cached input, uncached input and output, sorted by cached
-- share, then uncached share, then session id, and cut into equal rank bins. Per bin: `percentile`, its middle in
-- percent of the sessions; `cached`, `uncached` and `output`, the bin's mean shares rescaled to sum to 1; and
-- `bin_sessions` (its sessions). `pooled_cached`, `pooled_uncached` and `pooled_output`, the same on every row, are the
-- shares of the whole selection's cost.
-- `ranked_bin`, the same on every row, names the one bin the page counts the figure's rows in, so it is hidden only
-- when the whole selection is thin, and `rows`, the same on every row, is the number of sessions ranked.
WITH constants AS (
  SELECT 1.0 AS cached_price, -- the pipeline's prices.CACHED_PRICE: a cached input token
         10.0 AS uncached_price, -- prices.UNCACHED_PRICE: an uncached input token
         50.0 AS output_price, -- prices.OUTPUT_PRICE: an output token
         200 AS max_rank_bins, -- binning.MAX_RANK_BINS: never more bins than this
         10 AS sessions_per_rank_bin -- binning.SESSIONS_PER_RANK_BIN: nor fewer sessions per bin than this
),
request_costs AS (
  SELECT requests.session_id,
         requests.cache_read_tokens * constants.cached_price AS cached,
         requests.uncached_tokens * constants.uncached_price AS uncached,
         coalesce(requests.completion_tokens, 0) * constants.output_price AS output
  FROM requests, constants
  WHERE requests.is_top_level
    AND requests.cache_read_tokens IS NOT NULL
    AND requests.prompt_tokens > 0
    AND requests.week IN (SELECT week FROM selected_weeks)
    AND requests.harness IN (SELECT harness FROM selected_harnesses)
),
session_costs AS (
  SELECT session_id, sum(cached) AS cached, sum(uncached) AS uncached, sum(output) AS output
  FROM request_costs
  GROUP BY session_id
  HAVING sum(cached) + sum(uncached) + sum(output) > 0
),
session_shares AS (
  SELECT session_id,
         cached / (cached + uncached + output) AS cached_share,
         uncached / (cached + uncached + output) AS uncached_share,
         output / (cached + uncached + output) AS output_share
  FROM session_costs
),
ranked_sessions AS (
  SELECT cached_share,
         uncached_share,
         output_share,
         row_number() OVER (ORDER BY cached_share, uncached_share, session_id) - 1 AS session_rank,
         count(*) OVER () AS sessions
  FROM session_shares
),
binned_sessions AS (
  SELECT ranked_sessions.*,
         least(constants.max_rank_bins, greatest(sessions // constants.sessions_per_rank_bin, 1)) AS bin_count
  FROM ranked_sessions, constants
),
bins AS (
  SELECT session_rank * bin_count // sessions AS bin,
         any_value(bin_count) AS bin_count,
         any_value(sessions) AS sessions,
         avg(cached_share) AS cached,
         avg(uncached_share) AS uncached,
         avg(output_share) AS output,
         count(*) AS bin_sessions
  FROM binned_sessions
  GROUP BY bin
),
pooled AS (
  SELECT sum(cached) / (sum(cached) + sum(uncached) + sum(output)) AS pooled_cached,
         sum(uncached) / (sum(cached) + sum(uncached) + sum(output)) AS pooled_uncached,
         sum(output) / (sum(cached) + sum(uncached) + sum(output)) AS pooled_output
  FROM session_costs
)
SELECT (bins.bin + 0.5) * 100 / bins.bin_count AS percentile,
       bins.cached / (bins.cached + bins.uncached + bins.output) AS cached,
       bins.uncached / (bins.cached + bins.uncached + bins.output) AS uncached,
       bins.output / (bins.cached + bins.uncached + bins.output) AS output,
       bins.bin_sessions,
       'ranked sessions' AS ranked_bin,
       bins.sessions AS rows,
       pooled.pooled_cached,
       pooled.pooled_uncached,
       pooled.pooled_output
FROM bins, pooled
ORDER BY percentile;
