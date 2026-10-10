-- The view `requests`: every row of requests.parquet. database.js replaces {data_url} with the data folder's absolute URL before running it.
CREATE VIEW requests AS
SELECT *
FROM read_parquet('{data_url}/requests.parquet');
