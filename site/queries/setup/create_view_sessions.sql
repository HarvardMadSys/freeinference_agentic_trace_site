-- The view `sessions`: every row of sessions.parquet. database.js replaces {data_url} with the data folder's absolute URL before running it.
CREATE VIEW sessions AS
SELECT *
FROM read_parquet('{data_url}/sessions.parquet');
