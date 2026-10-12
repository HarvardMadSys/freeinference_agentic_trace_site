-- One row per part of the machine time of the top-level sessions of the selected weeks and harnesses, read from the
-- view `session_time`: `part` (`prefill`, `decode` or `tool`), `speedup`, the sessions' summed machine time over that
-- sum with the part alone run twice as fast, and `rows`, the same on every row: the sessions with any machine time.
-- Machine time is a session's prefill, decode and capped tool time; a person's time is not machine time.
WITH constants AS (
  SELECT 0.5 AS sped_up_share -- a part run twice as fast takes half its time
),
machine_times AS (
  SELECT sum(prefill_s) AS prefill,
         sum(decode_s) AS decode,
         sum(capped_tool_s) AS tool,
         sum(prefill_s + decode_s + capped_tool_s) AS total,
         count(*) AS sessions
  FROM session_time
  WHERE prefill_s + decode_s + capped_tool_s > 0
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
