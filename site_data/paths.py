"""The names of the files the data step writes into the site's data folder."""

REQUESTS_FILE = "requests.parquet"  # one row per request
TOOL_CALLS_FILE = "tool_calls.parquet"  # one row per tool call
SESSIONS_FILE = "sessions.parquet"  # one row per session
SIMULATION_FILE = "simulation.parquet"  # one row per simulated week, scope, policy and TTL
WEEKS_FILE = "weeks.json"  # the index of weeks, read by every page before DuckDB loads
