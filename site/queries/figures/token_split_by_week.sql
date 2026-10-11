-- One row per selected week and token part (`cached`, `uncached` or `output`), over the week's top-level requests of
-- the selected harnesses whose provider reports cache reads and that have an input: the part's `share` of the three
-- parts' tokens summed, and the week's `rows` (those requests).
WITH reporting_requests AS (
  SELECT week, cache_read_tokens, uncached_tokens, completion_tokens
  FROM requests
  WHERE is_top_level
    AND cache_read_tokens IS NOT NULL
    AND prompt_tokens > 0
    AND week IN (SELECT week FROM selected_weeks)
    AND harness IN (SELECT harness FROM selected_harnesses)
),
week_tokens AS (
  SELECT week,
         count(*) AS rows,
         sum(cache_read_tokens) AS cached,
         sum(uncached_tokens) AS uncached,
         coalesce(sum(completion_tokens), 0) AS output
  FROM reporting_requests
  GROUP BY week
),
part_tokens AS (
  UNPIVOT week_tokens ON cached, uncached, output INTO NAME part VALUE tokens
)
SELECT week,
       part,
       tokens / sum(tokens) OVER (PARTITION BY week) AS share,
       rows
FROM part_tokens
ORDER BY week, part;
