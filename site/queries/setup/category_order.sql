-- One row per tool category, with its calls in top-level sessions over every week and scope, largest first (ties by
-- name): the global order that gives each category the same colour on every chart, whatever the selection.
SELECT category,
       count(*) AS calls
FROM tool_calls
WHERE is_top_level
GROUP BY category
ORDER BY calls DESC, category;
