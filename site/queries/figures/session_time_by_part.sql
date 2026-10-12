-- One row per rank bin of the top-level sessions of the selected weeks and harnesses with any time, read from the
-- view `session_time`: each session as the shares of its time that are prefill, decode, tool time (uncapped) and user
-- idle time, sorted by user share, then tool share, then session id, and cut into equal rank bins. Per bin:
-- `percentile`, its middle in percent of the sessions; `prefill`, `decode`, `tool` and `user`, the bin's mean shares
-- rescaled to sum to 1; and `bin_sessions` (its sessions). `mean_prefill_share`, `mean_decode_share`,
-- `mean_tool_share` and `mean_user_share`, the same on every row, are the mean over the sessions of each share.
-- `ranked_bin`, the same on every row, names the one bin the page counts the figure's rows in, so it is hidden only
-- when the whole selection is thin, and `rows`, the same on every row, is the number of sessions ranked.
WITH constants AS (
  SELECT 200 AS max_rank_bins, -- the pipeline's binning.MAX_RANK_BINS: never more bins than this
         10 AS sessions_per_rank_bin -- binning.SESSIONS_PER_RANK_BIN: nor fewer sessions per bin than this
),
session_shares AS (
  SELECT week,
         session_id,
         prefill_s / (prefill_s + decode_s + tool_s + user_s) AS prefill_share,
         decode_s / (prefill_s + decode_s + tool_s + user_s) AS decode_share,
         tool_s / (prefill_s + decode_s + tool_s + user_s) AS tool_share,
         user_s / (prefill_s + decode_s + tool_s + user_s) AS user_share
  FROM session_time
  WHERE prefill_s + decode_s + tool_s + user_s > 0
),
ranked_sessions AS (
  SELECT prefill_share,
         decode_share,
         tool_share,
         user_share,
         row_number() OVER (ORDER BY user_share, tool_share, session_id, week) - 1 AS session_rank,
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
         avg(prefill_share) AS prefill,
         avg(decode_share) AS decode,
         avg(tool_share) AS tool,
         avg(user_share) AS user_idle,
         count(*) AS bin_sessions
  FROM binned_sessions
  GROUP BY bin
),
mean_shares AS (
  SELECT avg(prefill_share) AS mean_prefill_share,
         avg(decode_share) AS mean_decode_share,
         avg(tool_share) AS mean_tool_share,
         avg(user_share) AS mean_user_share
  FROM session_shares
)
SELECT (bins.bin + 0.5) * 100 / bins.bin_count AS percentile,
       bins.prefill / (bins.prefill + bins.decode + bins.tool + bins.user_idle) AS prefill,
       bins.decode / (bins.prefill + bins.decode + bins.tool + bins.user_idle) AS decode,
       bins.tool / (bins.prefill + bins.decode + bins.tool + bins.user_idle) AS tool,
       bins.user_idle / (bins.prefill + bins.decode + bins.tool + bins.user_idle) AS "user",
       bins.bin_sessions,
       'ranked sessions' AS ranked_bin,
       bins.sessions AS rows,
       mean_shares.mean_prefill_share,
       mean_shares.mean_decode_share,
       mean_shares.mean_tool_share,
       mean_shares.mean_user_share
FROM bins, mean_shares
ORDER BY percentile;
