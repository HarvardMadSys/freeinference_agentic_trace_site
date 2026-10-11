-- The view `requests`: the rows of the files `requests/week=<sunday>/rows.parquet` of every week, with `week`
-- read from the folder name as a string. The opener replaces the files placeholder with the files' names, each
-- single-quoted, separated by commas.
CREATE VIEW requests AS
SELECT *
FROM read_parquet([{files}], hive_partitioning = true, hive_types = {'week': VARCHAR});
