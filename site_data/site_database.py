"""The site's database in DuckDB over the site's frames in memory, in which `make data` and the tests run the site's
queries.

It is opened by registering each of the four frames as the table of its name,
`requests`, `tool_calls`, `sessions` and `simulation`, then running the
`site/queries/setup/create_*.sql` statements in this order: the selection
tables, then the views over the selection, then the benchmark harness table,
which is filled with the harnesses the harness index marks as the benchmark's.
The selection tables are filled through the `clear_*` and `insert_*`
statements, one parameterised insert per value. A query's name is its path
under `site/queries/` without `.sql`.
"""

import dataclasses
import pathlib

import duckdb
import pandas

from site_data import harnesses

QUERIES_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site" / "queries"
SETUP_FOLDER = QUERIES_FOLDER / "setup"  # the statements that create and fill the views and tables
# One thread, so that a sum of floats adds its rows in the same order on every run and a rebuilt answer is the same to
# the last bit.
THREADS = 1

# The statements that make the empty selection tables, run after the frames are registered.
SELECTION_TABLE_STATEMENTS = [
    "setup/create_selected_weeks",
    "setup/create_selected_harnesses",
]

# The statements that make the views over the selected rows, run after the selection tables they read.
SELECTION_VIEW_STATEMENTS = [
    "setup/create_view_session_time",
]

# The statement that makes the table of benchmark harnesses, run after the selection tables.
BENCHMARK_TABLE_STATEMENT = "setup/create_benchmark_harness"
# The statement that adds one harness to the table of benchmark harnesses, run once per benchmark harness.
BENCHMARK_INSERT_STATEMENT = "setup/insert_benchmark_harness"


@dataclasses.dataclass(frozen=True)
class SiteFrames:
    """The site's four kinds of row, each frame with its `week` column; each is the table of its field's name."""

    requests: pandas.DataFrame  # one row per request (`site_data/requests.py`)
    tool_calls: pandas.DataFrame  # one row per tool call (`site_data/tool_calls.py`)
    sessions: pandas.DataFrame  # one row per session (`site_data/sessions.py`)
    simulation: pandas.DataFrame  # one row per scope and TTL of a simulated week; none when no week is simulated


@dataclasses.dataclass(frozen=True)
class QueryRows:
    """A query's result: its column names, and each row's values in their order."""

    columns: list[str]
    rows: list[list]


def statement_text(name: str) -> str:
    """The text of the statement `name`: the file `site/queries/<name>.sql`."""
    return (QUERIES_FOLDER / f"{name}.sql").read_text()


def open_site_database(frames: SiteFrames,
                       harness_entries: list[harnesses.HarnessEntry]) -> duckdb.DuckDBPyConnection:
    """A new in-memory database on `THREADS` threads: the four frames as tables, the empty selection tables, the views
    over them, and the benchmark harness table filled with the entries marked benchmark."""
    connection = duckdb.connect(config={"threads": THREADS})
    connection.register("requests", frames.requests)
    connection.register("tool_calls", frames.tool_calls)
    connection.register("sessions", frames.sessions)
    connection.register("simulation", frames.simulation)
    for name in [*SELECTION_TABLE_STATEMENTS, *SELECTION_VIEW_STATEMENTS]:
        connection.execute(statement_text(name))
    connection.execute(statement_text(BENCHMARK_TABLE_STATEMENT))
    for entry in harness_entries:
        if entry.benchmark:
            connection.execute(statement_text(BENCHMARK_INSERT_STATEMENT), [entry.harness])
    return connection


def select_weeks(connection: duckdb.DuckDBPyConnection, week_list: list[str], harness_list: list[str]) -> None:
    """Empty `selected_weeks` and `selected_harnesses`, then fill them with the weeks (Sundays) and harnesses."""
    connection.execute(statement_text("setup/clear_selected_weeks"))
    for week in week_list:
        connection.execute(statement_text("setup/insert_selected_week"), [week])
    connection.execute(statement_text("setup/clear_selected_harnesses"))
    for harness in harness_list:
        connection.execute(statement_text("setup/insert_selected_harness"), [harness])


def query_rows(connection: duckdb.DuckDBPyConnection, name: str) -> QueryRows:
    """The rows of the query `name`, its columns and each row's values in their order."""
    result = connection.execute(statement_text(name))
    columns = [column[0] for column in result.description]
    return QueryRows(columns=columns, rows=[list(row) for row in result.fetchall()])


def run_query(connection: duckdb.DuckDBPyConnection, name: str) -> pandas.DataFrame:
    """The rows of the query `name`, as a frame with the query's columns."""
    return connection.execute(statement_text(name)).df()
