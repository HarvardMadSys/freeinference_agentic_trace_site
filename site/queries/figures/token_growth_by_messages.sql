-- One row per power-of-two bin of messages in the request, over the top-level requests of the selected weeks and
-- scope whose provider reports cache reads, with an input and at least one message: the bin's smallest message
-- count `bin_start` (bins run from 2^k to 2^(k+1) - 1 messages), its `rows` (requests), and the median cached,
-- uncached and output tokens of its requests, each over the requests where it is known. Uncached tokens are input
-- minus cached tokens, not clipped at zero, as the paper's growth figure takes them.
WITH growth_requests AS (
  SELECT CAST(power(2, floor(log2(n_messages))) AS BIGINT) AS bin_start,
         cache_read_tokens,
         prompt_tokens - cache_read_tokens AS unclipped_uncached_tokens,
         completion_tokens
  FROM requests
  WHERE is_top_level
    AND cache_read_tokens IS NOT NULL
    AND prompt_tokens > 0
    AND n_messages >= 1
    AND week IN (SELECT week FROM selected_weeks)
    AND scope IN (SELECT scope FROM selected_scopes)
)
SELECT bin_start,
       count(*) AS rows,
       median(cache_read_tokens) AS median_cached_tokens,
       median(unclipped_uncached_tokens) AS median_uncached_tokens,
       median(completion_tokens) AS median_output_tokens
FROM growth_requests
GROUP BY bin_start
ORDER BY bin_start;
