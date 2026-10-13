"""The site's database for the tests: `site_data.site_database`, which sets the database up as the data step does,
under the names the tests use, a query's rows as a frame, and the list of every query outside `setup/`.

A test opens the database over the fixture's frames, fills the selection
tables and runs a query by name, exactly as the data step runs it; or, for a
case the fixture does not hold, over a few rows of its own.
"""

import duckdb
import pandas
import pyarrow

import site_data.site_database

QUERIES_FOLDER = site_data.site_database.QUERIES_FOLDER  # every query file, under its page's folder
SETUP_FOLDER = site_data.site_database.SETUP_FOLDER  # the statements that create and fill the views and tables
SELECTION_TABLE_STATEMENTS = site_data.site_database.SELECTION_TABLE_STATEMENTS
SELECTION_VIEW_STATEMENTS = site_data.site_database.SELECTION_VIEW_STATEMENTS
BENCHMARK_TABLE_STATEMENT = site_data.site_database.BENCHMARK_TABLE_STATEMENT

open_site_database = site_data.site_database.open_site_database
statement_text = site_data.site_database.statement_text
select_weeks = site_data.site_database.select_weeks


def run_query(connection: duckdb.DuckDBPyConnection, name: str) -> pandas.DataFrame:
    """The rows of the query `name`, as a frame with the query's columns."""
    return connection.execute(statement_text(name)).df()


def query_names() -> list[str]:
    """The name of every query a page runs: each `.sql` file under `site/queries/` outside `setup/`, sorted."""
    names = []
    for path in sorted(QUERIES_FOLDER.rglob("*.sql")):
        if SETUP_FOLDER not in path.parents:
            names.append(path.relative_to(QUERIES_FOLDER).with_suffix("").as_posix())
    return names


def database_of_rows(requests: pyarrow.Table, tool_calls: pyarrow.Table) -> duckdb.DuckDBPyConnection:
    """A database whose `requests` and `tool_calls` hold the given rows, with the empty selection tables and the empty
    benchmark harness table: for a case of a query that the fixture release does not hold."""
    connection = duckdb.connect()
    connection.register("requests", requests)
    connection.register("tool_calls", tool_calls)
    for name in [*SELECTION_TABLE_STATEMENTS, BENCHMARK_TABLE_STATEMENT]:
        connection.execute(statement_text(name))
    return connection


def add_selection_views(connection: duckdb.DuckDBPyConnection) -> None:
    """Make the views over the selection on a database of `database_of_rows`, whose requests then need every column
    the views read: a view checks its columns when it is made, and most cases hold only the columns their query
    reads."""
    for name in SELECTION_VIEW_STATEMENTS:
        connection.execute(statement_text(name))
