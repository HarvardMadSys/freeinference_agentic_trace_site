"""The answers of the default selection: every Explore and figure query, run once over the data folder as the browser
runs it, each written as `all_weeks/<page>/<query>.json`.

The default selection is every week of `weeks.json` and every harness of
`harnesses.json` that is not the benchmark's. The database is opened and the
selection tables filled by `site_database`, with the browser's own setup
statements, so an answer holds the rows the browser's query would return.

An answer is a JSON list with one object per row, its keys the query's column
names in the query's order. Integers are written as integers and other numbers
as floats, strings as strings, booleans as booleans and NULL as null.

When no week is simulated the data folder has no `simulation` view. A query
that then fails because it reads that view gets no answer file, and a page
asking for that answer shows the query's error; any other failure stops the
step.
"""

import dataclasses
import json
import math
import pathlib
import shutil

import duckdb

from site_data import harnesses, paths, site_database, weeks

ANSWERED_PAGES = ["explore", "figures"]  # the pages whose queries are answered; `session/` and `setup/` are not
SIMULATION_VIEW = "simulation"  # the view a data folder with no simulated week does not have
# Commas and colons without spaces: the answers are fetched by every visitor, the sessions table's above all.
JSON_SEPARATORS = (",", ":")


@dataclasses.dataclass(frozen=True)
class DefaultSelection:
    """The selection a page opens with: every week, and every harness that is not the benchmark's."""

    weeks: list[str]  # the Sundays, oldest first
    harnesses: list[str]  # in the order of `harnesses.json`


@dataclasses.dataclass(frozen=True)
class WrittenAnswers:
    """What the answers folder holds."""

    files: int
    bytes: int


def default_selection(data_directory: pathlib.Path) -> DefaultSelection:
    """Every week of the data folder's `weeks.json`, and every harness of its `harnesses.json` not marked benchmark."""
    week_list = [entry.week for entry in weeks.read_weeks_file(data_directory)]
    harness_list = []
    for entry in harnesses.read_harnesses_file(data_directory):
        if not entry.benchmark:
            harness_list.append(entry.harness)
    return DefaultSelection(weeks=week_list, harnesses=harness_list)


def answered_query_names() -> list[str]:
    """The name of every query of the answered pages, `<page>/<query>`, sorted."""
    names = []
    for page in ANSWERED_PAGES:
        for path in sorted((site_database.QUERIES_FOLDER / page).glob("*.sql")):
            names.append(f"{page}/{path.stem}")
    return names


def write_answers(data_directory: pathlib.Path) -> WrittenAnswers:
    """Replace the data folder's answers folder with the answer of every answered query under the default selection,
    except a query that fails because it reads the missing `simulation` view."""
    answers_directory = data_directory / paths.ANSWERS_FOLDER
    if answers_directory.exists():
        shutil.rmtree(answers_directory)  # a query since removed keeps no answer
    any_simulated = any(entry.simulated for entry in weeks.read_weeks_file(data_directory))
    selection = default_selection(data_directory)
    connection = site_database.open_site_database(data_directory)
    site_database.select_weeks(connection, selection.weeks, selection.harnesses)
    files, size = 0, 0
    for name in answered_query_names():
        rows = rows_unless_simulation_is_missing(connection, name, any_simulated)
        if rows is None:
            continue
        path = data_directory / paths.answer_file(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(answer_text(rows))
        files += 1
        size += path.stat().st_size
    connection.close()
    return WrittenAnswers(files=files, bytes=size)


def rows_unless_simulation_is_missing(connection: duckdb.DuckDBPyConnection, query_name: str,
                                      any_simulated: bool) -> list[dict] | None:
    """The query's answer rows; None when no week is simulated and the query fails for want of the `simulation`
    view. Any other failure is raised."""
    try:
        return answer_rows(connection, query_name)
    except duckdb.CatalogException as error:
        if any_simulated or SIMULATION_VIEW not in str(error):
            raise
        return None


def answer_rows(connection: duckdb.DuckDBPyConnection, query_name: str) -> list[dict]:
    """The rows of the query, each a dict from the query's column names, in its order, to the row's JSON values."""
    result = connection.execute(site_database.statement_text(query_name))
    columns = [column[0] for column in result.description]
    rows = []
    for row in result.fetchall():
        values = [json_value(value) for value in row]
        rows.append(dict(zip(columns, values)))
    return rows


def json_value(value: object) -> object:
    """The value as an answer holds it: a NaN becomes None, every other value is kept."""
    # JSON has no NaN, and a missing number is what a NaN stands for here.
    if isinstance(value, float) and math.isnan(value):
        return None
    return value


def answer_text(rows: list[dict]) -> str:
    """The rows as one line of JSON, keys in the rows' order, and a trailing newline."""
    # allow_nan=False: an infinity has no JSON form either, and must stop the step rather than write invalid JSON.
    return json.dumps(rows, separators=JSON_SEPARATORS, allow_nan=False) + "\n"
