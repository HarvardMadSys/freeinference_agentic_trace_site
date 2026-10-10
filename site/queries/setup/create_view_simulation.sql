-- The view `simulation`: every row of simulation.parquet. database.js replaces {data_url} with the data folder's absolute URL before running it.
CREATE VIEW simulation AS
SELECT *
FROM read_parquet('{data_url}/simulation.parquet');
