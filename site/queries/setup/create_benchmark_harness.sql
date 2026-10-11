-- The empty table of the benchmark harness: one row per harness whose sessions the pipeline counts as the
-- benchmark's, not the paper's population; filled from harnesses.json when the database opens.
CREATE TABLE benchmark_harness (harness VARCHAR);
