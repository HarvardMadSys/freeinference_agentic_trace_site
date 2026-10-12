-- One row per part of the machine time of the top-level sessions of the selected weeks and harnesses: `part`
-- (`prefill`, `decode` or `tool`), `speedup`, the sessions' summed machine time over that sum with the part alone run
-- twice as fast, and `rows`, the same on every row: the sessions with any machine time. A request's prefill is its
-- time to first token and its decode the rest of its latency when its TTFT is trusted; a request without a trusted
-- TTFT has unsplit latency, which its session shares out by its prefill ratio: its own when it has split time, else
-- its harness's over these sessions, else the one over them all. Tool time is the session's waits for a tool or a
-- subagent, a wait being the gap after the previous request, a negative one counted as none and a long one as the cap.
-- A person's time is not machine time.
WITH constants AS (
  SELECT ['tool', 'subagent'] AS tool_waits, -- the pipeline's latency.TOOL_WAITS: tool time
         900.0 AS tool_gap_cap_s, -- latency.TOOL_GAP_CAP_S: a tool wait counts for at most this many seconds
         0.5 AS sped_up_share -- a part run twice as fast takes half its time
),
request_times AS (
  SELECT requests.week,
         requests.session_id,
         requests.harness,
         CASE WHEN requests.is_trusted_ttft THEN requests.ttft_ms / 1000 ELSE 0 END AS prefill, -- 1000 ms to the second
         CASE WHEN requests.is_trusted_ttft THEN (requests.end_ms - requests.start_ms - requests.ttft_ms) / 1000 ELSE 0
         END AS decode,
         CASE WHEN requests.is_trusted_ttft THEN 0 ELSE (requests.end_ms - requests.start_ms) / 1000 END AS unsplit,
         CASE WHEN list_contains(constants.tool_waits, requests.waited_for)
              THEN least(greatest(requests.wait_s, 0), constants.tool_gap_cap_s) END AS tool
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
         coalesce(sum(tool), 0) AS tool
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
),
effective_times AS (
  SELECT prefill + unsplit * prefill_ratio AS prefill,
         decode + unsplit * (1 - prefill_ratio) AS decode,
         tool
  FROM session_ratios
),
machine_times AS (
  SELECT sum(prefill) AS prefill,
         sum(decode) AS decode,
         sum(tool) AS tool,
         sum(prefill + decode + tool) AS total,
         count(*) AS sessions
  FROM effective_times
  WHERE prefill + decode + tool > 0
),
part_times (position, part, seconds) AS (
  SELECT 1, 'prefill', prefill FROM machine_times
  UNION ALL
  SELECT 2, 'decode', decode FROM machine_times
  UNION ALL
  SELECT 3, 'tool', tool FROM machine_times
)
SELECT part_times.part,
       machine_times.total / (machine_times.total - constants.sped_up_share * part_times.seconds) AS speedup,
       machine_times.sessions AS rows
FROM part_times, machine_times, constants
WHERE machine_times.sessions > 0
ORDER BY part_times.position;
