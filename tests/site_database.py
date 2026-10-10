"""The site's database in Python DuckDB, set up and filled by the same `.sql` files the browser runs.

`site/js/shared/database.js` opens the browser's database by running the
`site/queries/setup/create_*.sql` statements in its own order, the four views
(with `{data_url}` replaced by the data folder's URL) and then the three
selection tables, and fills the selection tables through the `clear_*` and
`insert_*` statements, one parameterised insert per value. The functions here
run the same statements in the browser's order with a local data folder, so a
test runs a query exactly as a page runs it. A query's name is its path under
`site/queries/` without `.sql`.
"""

import pathlib

import duckdb
import pandas

QUERIES_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site" / "queries"
SETUP_FOLDER = QUERIES_FOLDER / "setup"  # the statements that create and fill the views and selection tables
DATA_URL_PLACEHOLDER = "{data_url}"  # stands for the data folder in a view statement, as in database.js

# The statements that register each data file as a view, in the order database.js runs them.
VIEW_STATEMENTS = [
    "setup/create_view_requests",
    "setup/create_view_tool_calls",
    "setup/create_view_sessions",
    "setup/create_view_simulation",
]

# The statements that make the empty selection tables, run after the views, in the order database.js runs them.
SELECTION_TABLE_STATEMENTS = [
    "setup/create_selected_weeks",
    "setup/create_selected_scopes",
    "setup/create_selected_session",
]

# The scopes of the data each scope a visitor can choose covers, as `scopesOf` in selection.js gives them.
SCOPES_OF = {"Agentic": ["Agentic"], "SWE-Bench": ["SWE-Bench"], "All": ["Agentic", "SWE-Bench"]}


def statement_text(name: str) -> str:
    """The text of the statement `name`: the file `site/queries/<name>.sql`."""
    return (QUERIES_FOLDER / f"{name}.sql").read_text()


def open_site_database(data_directory: pathlib.Path) -> duckdb.DuckDBPyConnection:
    """A new in-memory database: the four views over `data_directory`, then the empty selection tables."""
    connection = duckdb.connect()
    for name in VIEW_STATEMENTS:
        connection.execute(statement_text(name).replace(DATA_URL_PLACEHOLDER, str(data_directory)))
    for name in SELECTION_TABLE_STATEMENTS:
        connection.execute(statement_text(name))
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
