-- One row per tool category: its number of tool calls over every week and every harness, largest first; the order that fixes each category's colour.
-- Every call counts, subagents' included, so every category a page can draw has a place in the order.
SELECT category,
       count(*) AS calls
FROM tool_calls
GROUP BY category
ORDER BY calls DESC, category;
