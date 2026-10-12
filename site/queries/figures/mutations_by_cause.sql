-- One row per row of the paper's mutation table, over the top-level requests of the selected weeks and harnesses that
-- follow another of their session (a transition), but those that switch model or provider (`switch`), which are
-- routing, not a change of context: `table_row`, the transition (`append` or `mutation`) or the cause of a mutation it
-- counts, in the table's order; `steps_share`, its transitions' share of all; `sessions_share`, the share of the
-- sessions with a transition that have one of its transitions, or for `append`, that have no mutation;
-- `prefill_share`, its transitions' share of the tokens all transitions miss with no TTL in the cache simulation,
-- counted in the weeks it covers; and `rows`, the transitions, the same on every row. No transition, no row.
WITH table_rows (table_row, row_order) AS (
  VALUES ('append', 1),
         ('mutation', 2),
         ('injection', 3),
         ('system_prompt', 4),
         ('tool_definitions', 5),
         ('dropped_turns', 6),
         ('compaction', 7),
         ('tool_result', 8),
         ('other', 9)
),
transitions AS (
  SELECT session_id, transition, cause, missed_tokens_no_ttl
  FROM requests
  WHERE is_top_level
    AND transition <> 'switch'
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
totals AS (
  SELECT count(*) AS transitions,
         count(DISTINCT session_id) AS sessions,
         count(DISTINCT session_id) FILTER (WHERE transition = 'mutation') AS sessions_with_mutation,
         sum(missed_tokens_no_ttl) AS missed_tokens
  FROM transitions
),
row_counts AS (
  SELECT table_rows.table_row,
         table_rows.row_order,
         count(transitions.session_id) AS steps,
         count(DISTINCT transitions.session_id) AS sessions,
         sum(transitions.missed_tokens_no_ttl) AS missed_tokens
  FROM table_rows
  LEFT JOIN transitions
    ON CASE WHEN table_rows.table_row IN ('append', 'mutation') THEN transitions.transition = table_rows.table_row
            ELSE transitions.cause = table_rows.table_row END
  GROUP BY table_rows.table_row, table_rows.row_order
)
SELECT row_counts.table_row,
       row_counts.steps / totals.transitions AS steps_share,
       CASE WHEN row_counts.table_row = 'append' THEN totals.sessions - totals.sessions_with_mutation
            ELSE row_counts.sessions END / totals.sessions AS sessions_share,
       coalesce(row_counts.missed_tokens, 0) / nullif(totals.missed_tokens, 0) AS prefill_share,
       totals.transitions AS rows
FROM row_counts
CROSS JOIN totals
WHERE totals.transitions > 0
ORDER BY row_counts.row_order;
