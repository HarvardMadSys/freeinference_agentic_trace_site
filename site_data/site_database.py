"""The site's database in DuckDB, set up and filled by the same `.sql` files the browser runs.

The browser opens its database by running the `site/queries/setup/create_*.sql`
statements in its own order: the four views of the files, then the selection
tables, then the views over the selection, then the benchmark harness table. A view statement's `{files}` placeholder is
replaced by the files of the weeks that have that kind of row, as `weeks.json`
lists them, each single-quoted and separated by commas; the benchmark harness
table is filled with the harnesses `harnesses.json` marks as the benchmark's.
The selection tables are filled through the `clear_*` and `insert_*`
statements, one parameterised insert per value. The functions here run the
same statements in the same order over a local data folder, so a query runs
here exactly as a page runs it. A query's name is its path under
`site/queries/` without `.sql`.

A kind no week has a file of (the simulation, when no week is simulated) gets
no view, since DuckDB cannot read an empty list of files; a query of it then
fails with DuckDB's message that the view does not exist.
"""

import pathlib

import duckdb
import pandas

from site_data import harnesses, paths, weeks

QUERIES_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site" / "queries"
SETUP_FOLDER = QUERIES_FOLDER / "setup"  # the statements that create and fill the views and tables
FILES_PLACEHOLDER = "{files}"  # stands for a view's list of quoted file names, as in js/engine/duckdb_files.js
# One thread, as DuckDB-WASM runs: a sum of floats then adds its rows in the same order on every run, so a rebuilt
# answer is the same to the last bit.
THREADS = 1

# The statement that registers each kind of row as a view, by the kind's folder, in the order
# js/engine/duckdb_views.js runs them.
VIEW_STATEMENTS = {
    paths.REQUESTS_FOLDER: "setup/create_view_requests",
    paths.TOOL_CALLS_FOLDER: "setup/create_view_tool_calls",
    paths.SESSIONS_FOLDER: "setup/create_view_sessions",
    paths.SIMULATION_FOLDER: "setup/create_view_simulation",
}

# The statements that make the empty selection tables, run after the views, in the order js/engine/duckdb_views.js
# runs them.
SELECTION_TABLE_STATEMENTS = [
    "setup/create_selected_weeks",
    "setup/create_selected_harnesses",
    "setup/create_selected_session",
]

# The statements that make the views over the selected rows, run after the selection tables they read, in the order
# js/engine/duckdb_views.js runs them.
SELECTION_VIEW_STATEMENTS = [
    "setup/create_view_session_time",
]

# The statement that makes the table of benchmark harnesses, run after the selection tables.
BENCHMARK_TABLE_STATEMENT = "setup/create_benchmark_harness"
# The statement that adds one harness to the table of benchmark harnesses, run once per benchmark harness.
BENCHMARK_INSERT_STATEMENT = "setup/insert_benchmark_harness"


def statement_text(name: str) -> str:
    """The text of the statement `name`: the file `site/queries/<name>.sql`."""
    return (QUERIES_FOLDER / f"{name}.sql").read_text()


def open_site_database(data_directory: pathlib.Path) -> duckdb.DuckDBPyConnection:
    """A new in-memory database on `THREADS` threads over `data_directory`: the views of its week files, the empty
    selection tables, the views over them, and the benchmark harness table filled from its `harnesses.json`."""
    connection = duckdb.connect(config={"threads": THREADS})
    entries = weeks.read_weeks_file(data_directory)
    for kind_folder, name in VIEW_STATEMENTS.items():
        week_list = weeks.weeks_with_file(entries, kind_folder)
        if week_list:
            files = week_files(data_directory, kind_folder, week_list)
            connection.execute(statement_text(name).replace(FILES_PLACEHOLDER, quoted_list(files)))
    for name in [*SELECTION_TABLE_STATEMENTS, *SELECTION_VIEW_STATEMENTS]:
        connection.execute(statement_text(name))
    connection.execute(statement_text(BENCHMARK_TABLE_STATEMENT))
    for entry in harnesses.read_harnesses_file(data_directory):
        if entry.benchmark:
            connection.execute(statement_text(BENCHMARK_INSERT_STATEMENT), [entry.harness])
    return connection


def week_files(data_directory: pathlib.Path, kind_folder: str, week_list: list[str]) -> list[str]:
    """The paths of the kind's files of the listed weeks, under `data_directory`, in the weeks' order."""
    return [str(data_directory / paths.week_file(kind_folder, week)) for week in week_list]


def quoted_list(names: list[str]) -> str:
    """The names as SQL string literals separated by commas: each in single quotes, a quote inside doubled."""
    quoted = []
    for name in names:
        doubled = name.replace("'", "''")
        quoted.append(f"'{doubled}'")
    return ", ".join(quoted)


def select_weeks(connection: duckdb.DuckDBPyConnection, week_list: list[str], harness_list: list[str]) -> None:
    """Empty `selected_weeks` and `selected_harnesses`, then fill them with the weeks (Sundays) and harnesses."""
    connection.execute(statement_text("setup/clear_selected_weeks"))
    for week in week_list:
        connection.execute(statement_text("setup/insert_selected_week"), [week])
    connection.execute(statement_text("setup/clear_selected_harnesses"))
    for harness in harness_list:
        connection.execute(statement_text("setup/insert_selected_harness"), [harness])


def select_session(connection: duckdb.DuckDBPyConnection, week: str, root_session_id: str) -> None:
    """Empty `selected_session`, then hold the one top-level session `root_session_id` of the week `week`."""
    connection.execute(statement_text("setup/clear_selected_session"))
    connection.execute(statement_text("setup/insert_selected_session"), [week, root_session_id])


def run_query(connection: duckdb.DuckDBPyConnection, name: str, parameters: list | None = None) -> pandas.DataFrame:
    """The rows of the query `name`, run with its `?` parameters in order, as a frame with the query's columns."""
    return connection.execute(statement_text(name), parameters or []).df()
