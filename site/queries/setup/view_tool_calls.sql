-- The view `tool_calls`: every row of tool_calls.parquet. database.js replaces {data_url} with the data folder's absolute URL before running it.
CREATE VIEW tool_calls AS
SELECT *
FROM read_parquet('{data_url}/tool_calls.parquet');
