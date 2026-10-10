-- One row per power-of-two bin of input tokens and role, over the top-level requests of the selected weeks and scope
-- with any role tokens: the bin's smallest input `bin_start` (bins run from 2^k to 2^(k+1) - 1 tokens), the role
-- (`system`, `user`, `assistant`, `tool` or `tool_definitions`), its `share` of the bin's role tokens summed, and the
-- bin's `rows` (requests).
WITH role_requests AS (
  SELECT CAST(power(2, floor(log2(prompt_tokens))) AS BIGINT) AS bin_start,
         system_tokens,
         user_tokens,
         assistant_tokens,
         tool_tokens,
         tool_definition_tokens
  FROM requests
  WHERE is_top_level
    AND prompt_tokens >= 1
    AND system_tokens + user_tokens + assistant_tokens + tool_tokens + tool_definition_tokens > 0
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
),
bin_tokens AS (
  SELECT bin_start,
         count(*) AS rows,
         sum(system_tokens) AS "system",
         sum(user_tokens) AS "user",
         sum(assistant_tokens) AS "assistant",
         sum(tool_tokens) AS "tool",
         sum(tool_definition_tokens) AS "tool_definitions"
  FROM role_requests
  GROUP BY bin_start
),
role_tokens AS (
  UNPIVOT bin_tokens ON "system", "user", "assistant", "tool", "tool_definitions" INTO NAME role VALUE tokens
)
SELECT bin_start,
       role,
       tokens / sum(tokens) OVER (PARTITION BY bin_start) AS share,
       rows
FROM role_tokens
ORDER BY bin_start, role;
