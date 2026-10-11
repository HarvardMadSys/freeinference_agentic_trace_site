"""The names of the folders and files the data step writes into the site's data folder.

Each kind of row has a folder holding one file per week, at
`<kind>/week=<sunday>/rows.parquet`; DuckDB reads the week from the folder name.
The answers of the default selection are at `all_weeks/<page>/<query>.json`.
"""

REQUESTS_FOLDER = "requests"  # one row per request
TOOL_CALLS_FOLDER = "tool_calls"  # one row per tool call
SESSIONS_FOLDER = "sessions"  # one row per session
SIMULATION_FOLDER = "simulation"  # one row per policy and TTL of a simulated week
WEEK_FOLDER_PREFIX = "week="  # a week's folder is this prefix and its Sunday, so DuckDB reads `week` from the path
ROWS_FILE = "rows.parquet"  # the one file in a week's folder
WEEKS_FILE = "weeks.json"  # the index of weeks, read by every page before DuckDB loads
HARNESSES_FILE = "harnesses.json"  # the index of harnesses, read by every page before DuckDB loads
ANSWERS_FOLDER = "all_weeks"  # the answer of every Explore and figure query for the default selection


def week_file(kind_folder: str, week: str) -> str:
    """The path of one week's file of a kind, relative to the data folder: `<kind>/week=<sunday>/rows.parquet`."""
    return f"{kind_folder}/{WEEK_FOLDER_PREFIX}{week}/{ROWS_FILE}"


def answer_file(query_name: str) -> str:
    """The path of a query's answer, relative to the data folder: `all_weeks/<page>/<query>.json`."""
    return f"{ANSWERS_FOLDER}/{query_name}.json"
