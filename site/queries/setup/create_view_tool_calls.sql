-- The view `tool_calls`: the rows of the files `tool_calls/week=<sunday>/rows.parquet` of every week, with `week`
-- read from the folder name as a string. The opener replaces {files} with the files' names, each single-quoted,
-- separated by commas.
CREATE VIEW tool_calls AS
SELECT *
FROM read_parquet([{files}], hive_partitioning = true, hive_types = {'week': VARCHAR});
