-- One row per tool category but Ask User, over the top-level requests of the selected weeks and harnesses that made a
-- call: the category of the request's first call, its `rows` (those requests, each counted once) and their
-- `mean_calls`, the mean number of calls they made; most calls first.
WITH constants AS (
  SELECT 'Ask User' AS ask_user_category -- schema.ASK_USER_CATEGORY: a call that hands control to the person
)
SELECT tool_calls.category,
       count(*) AS rows,
       avg(requests.n_tool_calls) AS mean_calls
FROM tool_calls
JOIN requests USING (week, session_id, step)
CROSS JOIN constants
WHERE tool_calls.call_index = 0
  AND tool_calls.category <> constants.ask_user_category
  AND requests.is_top_level
  AND requests.week IN (SELECT week FROM selected_weeks)
  AND requests.harness IN (SELECT harness FROM selected_harnesses)
GROUP BY tool_calls.category
ORDER BY mean_calls DESC, tool_calls.category;
