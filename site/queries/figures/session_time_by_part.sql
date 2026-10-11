-- One row per rank bin of the top-level sessions of the selected weeks and harnesses with any time: each session's
-- time split into `model` (its requests' latencies summed), `tool` (its waits for a tool or a subagent) and `human`
-- (its waits for a person: the user or an ask-user tool), a wait being the gap after the previous request and a
-- negative one counted as none; the sessions, each as the shares of its time, sorted by human share, then tool share,
-- then session id, and cut into equal rank bins. Per bin: `percentile`, its middle in percent of the sessions;
-- `model`, `tool` and `human`, the bin's mean shares rescaled to sum to 1; and `bin_sessions` (its sessions).
-- `mean_tool_share` and `mean_human_share`, the same on every row, are the mean over the sessions of each share.
-- `ranked_bin`, the same on every row, names the one bin the page counts the figure's rows in, so it is hidden only
-- when the whole selection is thin, and `rows`, the same on every row, is the number of sessions ranked.
WITH constants AS (
  SELECT ['tool', 'subagent'] AS tool_waits, -- the pipeline's latency.TOOL_WAITS: tool time
         ['user', 'ask_user_tool'] AS human_waits, -- latency.HUMAN_WAITS: a person's time
         200 AS max_rank_bins, -- binning.MAX_RANK_BINS: never more bins than this
         10 AS sessions_per_rank_bin -- binning.SESSIONS_PER_RANK_BIN: nor fewer sessions per bin than this
),
request_times AS (
  SELECT requests.session_id,
         (requests.end_ms - requests.start_ms) / 1000 AS model, -- 1000 milliseconds to the second
         CASE WHEN list_contains(constants.tool_waits, requests.waited_for) THEN greatest(requests.wait_s, 0) END AS tool,
         CASE WHEN list_contains(constants.human_waits, requests.waited_for) THEN greatest(requests.wait_s, 0) END AS human
  FROM requests, constants
  WHERE requests.is_top_level
    AND requests.week IN (SELECT week FROM selected_weeks)
    AND requests.harness IN (SELECT harness FROM selected_harnesses)
),
session_times AS (
  SELECT session_id,
         coalesce(sum(model), 0) AS model,
         coalesce(sum(tool), 0) AS tool,
         coalesce(sum(human), 0) AS human
  FROM request_times
  GROUP BY session_id
),
session_shares AS (
  SELECT session_id,
         model / (model + tool + human) AS model_share,
         tool / (model + tool + human) AS tool_share,
         human / (model + tool + human) AS human_share
  FROM session_times
  WHERE model + tool + human > 0
),
ranked_sessions AS (
  SELECT model_share,
         tool_share,
         human_share,
         row_number() OVER (ORDER BY human_share, tool_share, session_id) - 1 AS session_rank,
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
         avg(model_share) AS model,
         avg(tool_share) AS tool,
         avg(human_share) AS human,
         count(*) AS bin_sessions
  FROM binned_sessions
  GROUP BY bin
),
mean_shares AS (
  SELECT avg(tool_share) AS mean_tool_share, avg(human_share) AS mean_human_share
  FROM session_shares
)
SELECT (bins.bin + 0.5) * 100 / bins.bin_count AS percentile,
       bins.model / (bins.model + bins.tool + bins.human) AS model,
       bins.tool / (bins.model + bins.tool + bins.human) AS tool,
       bins.human / (bins.model + bins.tool + bins.human) AS human,
       bins.bin_sessions,
       'ranked sessions' AS ranked_bin,
       bins.sessions AS rows,
       mean_shares.mean_tool_share,
       mean_shares.mean_human_share
FROM bins, mean_shares
ORDER BY percentile;
