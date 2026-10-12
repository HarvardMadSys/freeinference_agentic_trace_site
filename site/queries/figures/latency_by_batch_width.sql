-- One row per width (the number of calls a request made, from 1 to 8, eight or more counted as 8) over the top-level
-- requests of the selected weeks and harnesses that made a call, made no Ask User call, and have a tool wait: the gap
-- before the session's next request, when that request waited for a tool, a person's answer to a question, or a
-- subagent. Per width: its `rows` (those requests), the 10th, 25th, 50th, 75th and 90th percentile of their tool wait
-- in seconds, and `serial_s`, the width times the median tool wait plus the median latency (end minus start) of the
-- one-call requests: the time the calls would take one per request.
WITH constants AS (
  SELECT ['tool', 'ask_user_tool', 'subagent'] AS tool_waited_for, -- tools.TOOL_WAITED_FOR: what a tool wait is
         'Ask User' AS ask_user_category, -- schema.ASK_USER_CATEGORY: a call that hands control to the person
         8 AS widest_drawn -- tools.WIDEST_DRAWN: requests of this many calls or more are drawn together
),
selected_requests AS (
  SELECT week,
         session_id,
         step,
         n_tool_calls,
         (end_ms - start_ms) / 1000 AS latency_s, -- 1000 milliseconds to the second
         lead(wait_s) OVER (PARTITION BY week, session_id ORDER BY step) AS next_wait_s,
         lead(waited_for) OVER (PARTITION BY week, session_id ORDER BY step) AS next_waited_for
  FROM requests
  WHERE is_top_level
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
asking_requests AS (
  SELECT DISTINCT tool_calls.week, tool_calls.session_id, tool_calls.step
  FROM tool_calls, constants
  WHERE tool_calls.category = constants.ask_user_category
),
waiting_requests AS (
  SELECT least(selected_requests.n_tool_calls, constants.widest_drawn) AS width,
         selected_requests.n_tool_calls = 1 AS is_one_call,
         selected_requests.latency_s,
         selected_requests.next_wait_s AS tool_wait_s
  FROM selected_requests
  CROSS JOIN constants
  LEFT JOIN asking_requests USING (week, session_id, step)
  WHERE selected_requests.n_tool_calls > 0
    AND asking_requests.step IS NULL
    AND list_contains(constants.tool_waited_for, selected_requests.next_waited_for)
    AND selected_requests.next_wait_s IS NOT NULL
),
one_call_step AS (
  SELECT quantile_cont(tool_wait_s, 0.5) + quantile_cont(latency_s, 0.5) AS step_s
  FROM waiting_requests
  WHERE is_one_call
)
SELECT waiting_requests.width,
       count(*) AS rows,
       quantile_cont(waiting_requests.tool_wait_s, 0.10) AS p10,
       quantile_cont(waiting_requests.tool_wait_s, 0.25) AS p25,
       quantile_cont(waiting_requests.tool_wait_s, 0.50) AS p50,
       quantile_cont(waiting_requests.tool_wait_s, 0.75) AS p75,
       quantile_cont(waiting_requests.tool_wait_s, 0.90) AS p90,
       waiting_requests.width * any_value(one_call_step.step_s) AS serial_s
FROM waiting_requests, one_call_step
GROUP BY waiting_requests.width
ORDER BY waiting_requests.width;
