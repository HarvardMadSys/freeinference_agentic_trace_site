"""The answers of the default selection: every Explore and figure query, and the colour orders, run once over the data
folder as the browser runs it, each written as `all_weeks/<folder>/<query>.json`, and the SHA-256 of each such
query's text and of each view over the selection the queries read, written to `all_weeks/queries.json` as
`{"<folder>/<query>": "<hex>"}`, so a query or view edited since can be found (`site_data/check_answers.py`).

The answers are written into `all_weeks.partial/`, which replaces `all_weeks/` only once every answer is written: a run
that fails leaves the previous answers in place.

The default selection is every week of `weeks.json` and every harness of
`harnesses.json` that is not the benchmark's. The database is opened and the
selection tables filled by `site_database`, with the browser's own setup
statements, so an answer holds the rows the browser's query would return.
The sessions table's query is the one exception: it is answered with every
week and every harness, the benchmark's included, and the tables are then
filled with the default selection again.
The colour orders read every week and every harness whatever the selection,
so their answers hold for any selection, not only the default.

An answer is a JSON list with one object per row, its keys the query's column
names in the query's order. Integers are written as integers and other numbers
as floats, strings as strings, booleans as booleans and NULL as null.

When no week is simulated the data folder has no `simulation` view. A query
that then fails because it reads that view gets no answer file, the step
names it, and a page asking for that answer shows the query's error; any
other failure stops the step.
"""

import dataclasses
import hashlib
import json
import math
import pathlib
import shutil

import duckdb

from site_data import harnesses, paths, site_database, weeks

ANSWERED_PAGES = ["explore", "figures"]  # the pages whose queries are answered; `session/` is not
# The setup queries that fix each harness's, model's, category's and provider's colour from every week and harness;
# answered so a page draws its colours without DuckDB.
COLOUR_ORDER_QUERIES = ["setup/category_order", "setup/harness_order", "setup/model_order", "setup/provider_order"]
# The query answered with every harness selected, the benchmark's too: the sessions table filters its answer in the
# browser, so the answer holds every row any harness filter can show; its `benchmark` column marks the benchmark's.
EVERY_HARNESS_QUERY = "explore/sessions_of_selection"
# Commas and colons without spaces: the answers are fetched by every visitor, the sessions table's above all.
JSON_SEPARATORS = (",", ":")


@dataclasses.dataclass(frozen=True)
class DefaultSelection:
    """The selection a page opens with: every week, and every harness that is not the benchmark's."""

    weeks: list[str]  # the Sundays, oldest first
    harnesses: list[str]  # in the order of `harnesses.json`


@dataclasses.dataclass(frozen=True)
class WrittenAnswers:
    """What the answers folder holds, and the queries it holds no answer of because no week is simulated."""

    files: int
    bytes: int
    unanswered: list[str]  # by name, `<folder>/<query>`; empty when a week is simulated


def default_selection(data_directory: pathlib.Path) -> DefaultSelection:
    """Every week of the data folder's `weeks.json`, and every harness of its `harnesses.json` not marked benchmark."""
    week_list = [entry.week for entry in weeks.read_weeks_file(data_directory)]
    harness_list = []
    for entry in harnesses.read_harnesses_file(data_directory):
        if not entry.benchmark:
            harness_list.append(entry.harness)
    return DefaultSelection(weeks=week_list, harnesses=harness_list)


def every_harness(data_directory: pathlib.Path) -> list[str]:
    """Every harness of the data folder's `harnesses.json`, the benchmark's included, in its order."""
    return [entry.harness for entry in harnesses.read_harnesses_file(data_directory)]


def answered_query_names(queries_folder: pathlib.Path = site_database.QUERIES_FOLDER) -> list[str]:
    """The name of every query of the answered pages in `queries_folder`, `<page>/<query>`, and of every colour order,
    sorted."""
    names = []
    for page in ANSWERED_PAGES:
        for path in sorted((queries_folder / page).glob("*.sql")):
            names.append(f"{page}/{path.stem}")
    return sorted([*names, *COLOUR_ORDER_QUERIES])


def write_answers(data_directory: pathlib.Path) -> WrittenAnswers:
    """Replace the data folder's answers folder with the answer of every answered query under the default selection,
    except a query that fails because it reads the missing `simulation` view, and the hash of every answered query's
    text."""
    partial_directory = data_directory / paths.PARTIAL_ANSWERS_FOLDER
    if partial_directory.exists():
        shutil.rmtree(partial_directory)  # left by a run that failed
    partial_directory.mkdir()
    written = write_answer_files(data_directory, partial_directory)
    hashes_text = json.dumps(query_hashes(), indent=1, sort_keys=True) + "\n"
    (partial_directory / paths.QUERY_HASHES_FILE).write_text(hashes_text)
    answers_directory = data_directory / paths.ANSWERS_FOLDER
    if answers_directory.exists():
        shutil.rmtree(answers_directory)  # a query since removed keeps no answer
    partial_directory.rename(answers_directory)
    return written


def write_answer_files(data_directory: pathlib.Path, answers_directory: pathlib.Path) -> WrittenAnswers:
    """Write into `answers_directory` the answer of every answered query under the data folder's default selection,
    and of `EVERY_HARNESS_QUERY` under every week and harness, except a query that fails because it reads the missing
    `simulation` view."""
    any_simulated = any(entry.simulated for entry in weeks.read_weeks_file(data_directory))
    selection = default_selection(data_directory)
    harness_list = every_harness(data_directory)
    files, size, unanswered = 0, 0, []
    # The block closes the connection whether or not a query fails.
    with site_database.open_site_database(data_directory) as connection:
        site_database.select_weeks(connection, selection.weeks, selection.harnesses)
        for name in answered_query_names():
            rows = answered_rows(connection, name, selection, harness_list, any_simulated)
            if rows is None:
                unanswered.append(name)
                continue
            path = answers_directory / paths.answer_file_in_folder(name)
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(answer_text(rows))
            files += 1
            size += path.stat().st_size
    return WrittenAnswers(files=files, bytes=size, unanswered=unanswered)


def query_hashes(queries_folder: pathlib.Path = site_database.QUERIES_FOLDER) -> dict[str, str]:
    """Each answered query of `queries_folder`, and each view over the selection that queries read, by name, to the
    SHA-256 of its text as hex. A query left without an answer because no week is simulated is included: its text is
    what the step ran."""
    hashes = {}
    for name in [*answered_query_names(queries_folder), *site_database.SELECTION_VIEW_STATEMENTS]:
        hashes[name] = query_text_hash(queries_folder, name)
    return hashes


def query_text_hash(queries_folder: pathlib.Path, name: str) -> str:
    """The SHA-256, as hex, of the bytes of the query `name`, the file `<queries_folder>/<name>.sql`."""
    return hashlib.sha256((queries_folder / f"{name}.sql").read_bytes()).hexdigest()


def answered_rows(connection: duckdb.DuckDBPyConnection, query_name: str, selection: DefaultSelection,
                  harness_list: list[str], any_simulated: bool) -> list[dict] | None:
    """The query's answer rows under the default selection the selection tables hold, or, for `EVERY_HARNESS_QUERY`,
    under its weeks and every harness of `harness_list`, the tables then holding the default selection again; None as
    `rows_unless_simulation_is_missing` gives it."""
    if query_name != EVERY_HARNESS_QUERY:
        return rows_unless_simulation_is_missing(connection, query_name, any_simulated)
    site_database.select_weeks(connection, selection.weeks, harness_list)
    rows = rows_unless_simulation_is_missing(connection, query_name, any_simulated)
    site_database.select_weeks(connection, selection.weeks, selection.harnesses)
    return rows


def rows_unless_simulation_is_missing(connection: duckdb.DuckDBPyConnection, query_name: str,
                                      any_simulated: bool) -> list[dict] | None:
    """The query's answer rows; None when no week is simulated and the query fails for want of the `simulation`
    view. Any other failure is raised."""
    try:
        return answer_rows(connection, query_name)
    except duckdb.CatalogException as error:
        # The view of a kind of row is named after the kind's folder.
        if any_simulated or paths.SIMULATION_FOLDER not in str(error):
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
