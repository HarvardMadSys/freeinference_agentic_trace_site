-- One row per top-level session of the first page of the Session Explorer's default view: the 20 newest top-level
-- sessions of the selected weeks and harnesses, newest first, with the columns of explore/sessions_of_selection and,
-- on every row, total_sessions, the number of top-level sessions of the selection that the full list holds.
-- The data step answers it with every harness selected, as it answers that list, so the page draws the first page from
-- this small answer before the full list has arrived. 20 is the table's rows per page (ROWS_PER_PAGE in
-- js/shared/table.js); a tie in start time is broken as the full list's order breaks it, most input first, then by id.
SELECT week,
       session_id,
       first_start_ms,
       harness,
       harness IN (SELECT harness FROM benchmark_harness) AS benchmark,
       main_model,
       requests,
       user_steps AS turns,
       tool_calls,
       duration_s,
       input_tokens,
       reported_input_tokens,
       cached_tokens,
       peak_prompt_tokens,
       count(*) OVER () AS total_sessions
FROM sessions
WHERE parent_session_id IS NULL
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
ORDER BY first_start_ms DESC, input_tokens DESC, session_id
LIMIT 20;
