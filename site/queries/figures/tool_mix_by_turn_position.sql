-- One row per scope, tenth of a turn and tool group that holds a call: the human-driven scope is the top-level
-- sessions of the selected weeks and harnesses but the benchmark's, the benchmark scope the top-level sessions of the
-- benchmark harness in the selected weeks, whatever harnesses are selected. A turn is a user step and the tool steps
-- after it; its requests that made a call are numbered k = 0 … n−1 in step order, and request k falls in the tenth
-- min(⌊10 (k + 0.5) / n⌋, 9), as each of its calls does. A call's group is its category's; a `*File Ops` call is
-- Write/Edit when the first word of any program it ran changes files, else Read when one only looks, else Other.
-- Per row: `scope` (`human-driven` or `benchmark`), `tenth` (0 to 9), `tool_group`, its `calls`, their `share` of the
-- calls of the scope's tenth, and `rows`, the same on every row of a scope: the scope's calls.
WITH constants AS (
  SELECT 10 AS tenths, -- trajectories.BINS: a turn is cut into this many parts
         '*File Ops' AS file_ops_category, -- trajectories.FILE_OPS: the category whose group its programs decide
         -- trajectories.READING_PROGRAMS: the `*File Ops` programs that only look
         ['ls', 'dir', 'cat', 'head', 'tail', 'wc', 'du', 'df', 'stat', 'file', 'tree', 'pwd', 'date', 'ps', 'top',
          'htop', 'env', 'printenv', 'whoami', 'uname', 'which', 'whereis', 'less', 'more', 'realpath', 'basename',
          'dirname', 'readlink', 'strings', 'hexdump', 'xxd', 'od', 'nl', 'column', 'diff', 'cmp', 'md5sum',
          'sha256sum', 'cksum', 'id', 'groups', 'hostname', 'uptime', 'free', 'history', 'cd', 'type', 'lsof',
          'tasklist', 'pgrep', 'nproc', 'getconf', 'get-content', 'get-childitem', 'test-path', 'select-object',
          'where-object', 'sort-object', 'measure-object', 'format-table', 'format-list', 'out-string',
          'write-output', 'write-host', 'resolve-path', 'convertfrom-json', 'convertto-json', 'get-command',
          'get-location', 'get-process', 'get-item', 'get-date', 'get-help', 'get-member', 'compare-object',
          'foreach-object', 'get-service', 'get-itemproperty', 'sort', 'uniq'] AS reading_programs,
         -- trajectories.WRITING_PROGRAMS: the `*File Ops` programs that change files
         ['mkdir', 'rm', 'rmdir', 'mv', 'cp', 'touch', 'chmod', 'chown', 'chgrp', 'ln', 'tee', 'truncate', 'dd',
          'shred', 'tar', 'zip', 'unzip', 'gzip', 'gunzip', '7z', 'patch', 'mktemp', 'install', 'rename', 'split',
          'new-item', 'remove-item', 'set-content', 'add-content', 'copy-item', 'move-item', 'rename-item',
          'out-file', 'clear-content', 'set-itemproperty', 'new-directory', 'del', 'ren', 'md', 'rd', 'ni',
          'mklink'] AS writing_programs
),
-- trajectories.GROUP_OF_CATEGORY: the group of a call of every other category; a category not listed is Other.
group_of_category (category, tool_group) AS (
  VALUES ('Read', 'Read'),
         ('*Search', 'Search'),
         ('Edit', 'Write/Edit'),
         ('Write', 'Write/Edit'),
         ('*Interpreter', 'Execute'),
         ('*Build/Test', 'Build/Test'),
         ('*Git/VCS', 'Git/VCS'),
         ('Browser', 'Browser/Web'),
         ('*Network', 'Browser/Web')
),
calling_requests AS (
  SELECT week,
         session_id,
         step,
         CASE WHEN harness IN (SELECT harness FROM benchmark_harness) THEN 'benchmark' ELSE 'human-driven' END AS scope,
         row_number() OVER (PARTITION BY week, session_id, turn ORDER BY step) - 1 AS position_in_turn,
         count(*) OVER (PARTITION BY week, session_id, turn) AS calling_requests_in_turn
  FROM requests
  WHERE is_top_level
    AND n_tool_calls > 0
    AND week IN (SELECT week FROM selected_weeks)
    AND (harness IN (SELECT harness FROM selected_harnesses) OR harness IN (SELECT harness FROM benchmark_harness))
),
binned_requests AS (
  SELECT calling_requests.week,
         calling_requests.session_id,
         calling_requests.step,
         calling_requests.scope,
         CAST(least(floor(constants.tenths * (calling_requests.position_in_turn + 0.5)
                          / calling_requests.calling_requests_in_turn),
                    constants.tenths - 1) AS INTEGER) AS tenth
  FROM calling_requests, constants
),
-- One row per program label a top-level `*File Ops` call ran, with the label's first word, lower-cased.
file_ops_words AS (
  SELECT tool_calls.week,
         tool_calls.session_id,
         tool_calls.step,
         tool_calls.call_index,
         lower(regexp_extract(unnest(tool_calls.programs), '^\s*(\S+)', 1)) AS first_word
  FROM tool_calls, constants
  WHERE tool_calls.category = constants.file_ops_category
    AND tool_calls.is_top_level
    AND tool_calls.week IN (SELECT week FROM selected_weeks)
),
-- One row per top-level `*File Ops` call with a program: whether any program it ran changes files, and whether any
-- only looks.
file_ops_calls AS (
  SELECT file_ops_words.week,
         file_ops_words.session_id,
         file_ops_words.step,
         file_ops_words.call_index,
         bool_or(list_contains(constants.writing_programs, file_ops_words.first_word)) AS runs_a_writing_program,
         bool_or(list_contains(constants.reading_programs, file_ops_words.first_word)) AS runs_a_reading_program
  FROM file_ops_words, constants
  GROUP BY file_ops_words.week, file_ops_words.session_id, file_ops_words.step, file_ops_words.call_index
),
grouped_calls AS (
  SELECT binned_requests.scope,
         binned_requests.tenth,
         CASE
           WHEN tool_calls.category <> constants.file_ops_category THEN coalesce(group_of_category.tool_group, 'Other')
           WHEN file_ops_calls.runs_a_writing_program THEN 'Write/Edit'
           WHEN file_ops_calls.runs_a_reading_program THEN 'Read'
           ELSE 'Other'
         END AS tool_group
  FROM binned_requests
  JOIN tool_calls USING (week, session_id, step)
  CROSS JOIN constants
  LEFT JOIN group_of_category ON tool_calls.category = group_of_category.category
  LEFT JOIN file_ops_calls USING (week, session_id, step, call_index)
),
group_counts AS (
  SELECT scope, tenth, tool_group, count(*) AS calls
  FROM grouped_calls
  GROUP BY scope, tenth, tool_group
)
SELECT scope,
       tenth,
       tool_group,
       calls,
       calls / sum(calls) OVER (PARTITION BY scope, tenth) AS share,
       CAST(sum(calls) OVER (PARTITION BY scope) AS BIGINT) AS rows
FROM group_counts
ORDER BY scope DESC, tenth, tool_group;
