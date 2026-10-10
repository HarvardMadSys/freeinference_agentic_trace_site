"""The site's database in Python DuckDB, set up and filled by the same `.sql` files the browser runs.

`site/js/shared/database.js` opens the browser's database by running every
`site/queries/setup/create_*.sql` statement, with `{data_url}` replaced by the
data folder's URL, and fills the selection tables through the `clear_*` and
`insert_*` statements, one parameterised insert per value. The functions here
do the same with a local data folder, so a test runs a query exactly as a page
runs it. A query's name is its path under `site/queries/` without `.sql`.
"""

import pathlib

import duckdb
import pandas

QUERIES_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site" / "queries"
SETUP_FOLDER = QUERIES_FOLDER / "setup"  # the statements that create and fill the views and selection tables
DATA_URL_PLACEHOLDER = "{data_url}"  # stands for the data folder in a view statement, as in database.js
CREATE_STATEMENT_PATTERN = "create_*.sql"  # the setup files that create a view or a selection table


def statement_text(name: str) -> str:
    """The text of the statement `name`: the file `site/queries/<name>.sql`."""
    return (QUERIES_FOLDER / f"{name}.sql").read_text()


def open_site_database(data_directory: pathlib.Path) -> duckdb.DuckDBPyConnection:
    """An in-memory database with the four views over `data_directory` and the empty selection tables."""
    connection = duckdb.connect()
    for path in sorted(SETUP_FOLDER.glob(CREATE_STATEMENT_PATTERN)):
        statement = path.read_text().replace(DATA_URL_PLACEHOLDER, str(data_directory))
        connection.execute(statement)
    return connection


def select_weeks(connection: duckdb.DuckDBPyConnection, weeks: list[str], scopes: list[str]) -> None:
    """Empty `selected_weeks` and `selected_scopes`, then fill them with `weeks` (Sundays) and `scopes`."""
    connection.execute(statement_text("setup/clear_selected_weeks"))
    for week in weeks:
        connection.execute(statement_text("setup/insert_selected_week"), [week])
    connection.execute(statement_text("setup/clear_selected_scopes"))
    for scope in scopes:
        connection.execute(statement_text("setup/insert_selected_scope"), [scope])


def select_session(connection: duckdb.DuckDBPyConnection, week: str, root_session_id: str) -> None:
    """Empty `selected_session`, then hold the one top-level session `root_session_id` of the week `week`."""
    connection.execute(statement_text("setup/clear_selected_session"))
    connection.execute(statement_text("setup/insert_selected_session"), [week, root_session_id])


def run_query(connection: duckdb.DuckDBPyConnection, name: str, parameters: list | None = None) -> pandas.DataFrame:
    """The rows of the query `name`, run with its `?` parameters in order, as a frame with the query's columns."""
    return connection.execute(statement_text(name), parameters or []).df()


def query_names() -> list[str]:
    """The name of every query a page runs: each `.sql` file under `site/queries/` outside `setup/`, sorted."""
    names = []
    for path in sorted(QUERIES_FOLDER.rglob("*.sql")):
        if SETUP_FOLDER not in path.parents:
            names.append(path.relative_to(QUERIES_FOLDER).with_suffix("").as_posix())
    return names
