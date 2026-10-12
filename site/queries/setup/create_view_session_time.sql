-- The view `session_time`: one row per top-level session of the selected weeks and harnesses, its `week`,
-- `session_id` and `harness`, and its time in seconds in the paper's four parts. A request's prefill is its time to
-- first token and its decode the rest of its latency when its TTFT is trusted; a request without a trusted TTFT has
-- unsplit latency, which its session shares out by its prefill ratio: its own when it has split time, else its
-- harness's over these sessions, else the one over them all. `prefill_s` and `decode_s` are the session's prefill and
-- decode with its unsplit latency shared out. `tool_s` is its waits for a tool or a subagent and `user_s` its waits
-- for a person (the user or an ask-user tool), a wait being the gap after the previous request and a negative one
-- counted as none; `capped_tool_s` is `tool_s` with each wait counted for at most the cap. The two figures of a
-- session's time read it, so the breakdown has this one home.
CREATE VIEW session_time AS
WITH constants AS (
  SELECT ['tool', 'subagent'] AS tool_waits, -- the pipeline's latency.TOOL_WAITS: tool time
         ['user', 'ask_user_tool'] AS user_waits, -- latency.HUMAN_WAITS: a person's time
         900.0 AS tool_gap_cap_s -- latency.TOOL_GAP_CAP_S: a capped tool wait counts for at most this many seconds
),
request_times AS (
  SELECT requests.week,
         requests.session_id,
         requests.harness,
         CASE WHEN requests.is_trusted_ttft THEN requests.ttft_ms / 1000 ELSE 0 END AS prefill, -- 1000 ms to the second
         CASE WHEN requests.is_trusted_ttft THEN (requests.end_ms - requests.start_ms - requests.ttft_ms) / 1000 ELSE 0
         END AS decode,
         CASE WHEN requests.is_trusted_ttft THEN 0 ELSE (requests.end_ms - requests.start_ms) / 1000 END AS unsplit,
         CASE WHEN list_contains(constants.tool_waits, requests.waited_for) THEN greatest(requests.wait_s, 0) END AS tool,
         CASE WHEN list_contains(constants.tool_waits, requests.waited_for)
              THEN least(greatest(requests.wait_s, 0), constants.tool_gap_cap_s) END AS capped_tool,
         CASE WHEN list_contains(constants.user_waits, requests.waited_for) THEN greatest(requests.wait_s, 0)
         END AS user_wait
  FROM requests, constants
  WHERE requests.is_top_level
    AND requests.week IN (SELECT week FROM selected_weeks)
    AND requests.harness IN (SELECT harness FROM selected_harnesses)
),
session_times AS (
  SELECT week,
         session_id,
         any_value(harness) AS harness,
         sum(prefill) AS prefill,
         sum(decode) AS decode,
         sum(unsplit) AS unsplit,
         coalesce(sum(tool), 0) AS tool,
         coalesce(sum(capped_tool), 0) AS capped_tool,
         coalesce(sum(user_wait), 0) AS user_wait
  FROM request_times
  GROUP BY week, session_id
),
harness_ratios AS (
  SELECT harness, sum(prefill) / sum(prefill + decode) AS prefill_ratio
  FROM session_times
  GROUP BY harness
  HAVING sum(prefill + decode) > 0
),
overall_ratio AS (
  SELECT coalesce(sum(prefill) / nullif(sum(prefill + decode), 0), 0) AS prefill_ratio
  FROM session_times
),
session_ratios AS (
  SELECT session_times.*,
         coalesce(session_times.prefill / nullif(session_times.prefill + session_times.decode, 0),
                  harness_ratios.prefill_ratio,
                  overall_ratio.prefill_ratio) AS prefill_ratio
  FROM session_times
  LEFT JOIN harness_ratios USING (harness)
  CROSS JOIN overall_ratio
)
SELECT week,
       session_id,
       harness,
       prefill + unsplit * prefill_ratio AS prefill_s,
       decode + unsplit * (1 - prefill_ratio) AS decode_s,
       tool AS tool_s,
       capped_tool AS capped_tool_s,
       user_wait AS user_s
FROM session_ratios;
