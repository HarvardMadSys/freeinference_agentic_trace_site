"""The answers of the default selection: every Explore and figure query, and the colour orders, run once over the
site's database, each written as `all_weeks/<folder>/<query>.json`, and the SHA-256 of each such query's text, of
each bucket query (`site_data/buckets.py`) and of each view over the selection the queries read, written to
`all_weeks/queries.json` as `{"<folder>/<query>": "<hex>"}`, so a query or view edited since can be found
(`stale_queries`).

The default selection is every week of `weeks.json` and every harness of
`harnesses.json` that is not the benchmark's. The selection tables are filled
by `site_database`, with the setup statements under `site/queries/setup/`.
The Explore page's own queries are the exceptions (`EVERY_HARNESS_QUERIES`):
the Overview's mixes and trends, the sessions table's list and first page, and
the trace totals are answered with every week and every harness, the
benchmark's included, and the tables are then filled with the default
selection again. The figure queries keep the paper's harnesses.
The colour orders read every week and every harness whatever the selection,
so their answers hold for any selection, not only the default.

An answer is a JSON list with one object per row, its keys the query's column
names in the query's order. Integers are written as integers and other numbers
as floats, strings as strings, booleans as booleans and NULL as null.
"""

import dataclasses
import hashlib
import json
import math
import pathlib
import shutil

import duckdb

from site_data import buckets, harnesses, paths, site_database, weeks

ANSWERED_PAGES = ["explore", "figures"]  # the folders whose queries are answered; `buckets/` fills the buckets instead
# The setup queries that fix each harness's, model's, category's and provider's colour from every week and harness;
# answered so a page draws its colours without DuckDB.
COLOUR_ORDER_QUERIES = ["setup/category_order", "setup/harness_order", "setup/model_order", "setup/provider_order"]
# The queries answered with every harness selected, the benchmark's too: the Overview, the session list and the stats
# strip show the whole trace. The sessions table filters its answer in the browser, so the answer holds every row any
# harness filter can show, its `benchmark` column marking the benchmark's, and its first page is that list's; the
# trace totals count the sessions it lists; and the donuts and trends count what the stats strip counts, so the
# donuts' centres equal its numbers.
EVERY_HARNESS_QUERIES = [
    "explore/model_mix",
    "explore/requests_per_week_by_model",
    "explore/input_tokens_per_week",
    "explore/sessions_per_week_by_harness",
    "explore/sessions_first_page",
    "explore/sessions_of_selection",
    "explore/trace_totals",
]


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


def write_answers(connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path) -> WrittenAnswers:
    """Replace the data folder's answers folder with the answer of every answered query under the default selection,
    or every harness for one of `EVERY_HARNESS_QUERIES`, and the hash of every answered query's text."""
    answers_directory = data_directory / paths.ANSWERS_FOLDER
    if answers_directory.exists():
        shutil.rmtree(answers_directory)  # a query since removed keeps no answer
    selection = default_selection(data_directory)
    harness_list = every_harness(data_directory)
    site_database.select_weeks(connection, selection.weeks, selection.harnesses)
    files, size = 0, 0
    for name in answered_query_names():
        path = answers_directory / paths.answer_file_in_folder(name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(answer_text(answered_rows(connection, name, selection, harness_list)))
        files += 1
        size += path.stat().st_size
    hashes_text = json.dumps(query_hashes(), indent=1, sort_keys=True) + "\n"
    (answers_directory / paths.QUERY_HASHES_FILE).write_text(hashes_text)
    return WrittenAnswers(files=files, bytes=size)


def query_hashes(queries_folder: pathlib.Path = site_database.QUERIES_FOLDER) -> dict[str, str]:
    """Each answered query of `queries_folder`, each bucket query, and each view over the selection that queries read,
    by name, to the SHA-256 of its text as hex."""
    hashes = {}
    hashed_names = [*answered_query_names(queries_folder), *buckets.BUCKET_PARTS.values(),
                    *site_database.SELECTION_VIEW_STATEMENTS]
    for name in hashed_names:
        hashes[name] = query_text_hash(queries_folder, name)
    return hashes


def stale_queries(data_directory: pathlib.Path,
                  queries_folder: pathlib.Path = site_database.QUERIES_FOLDER) -> list[str]:
    """The name of each hashed query or view of `queries_folder` whose text's hash is not the one recorded in the data
    folder's `all_weeks/queries.json`: edited, or added, since `make data` last wrote the answers and buckets."""
    recorded = json.loads((data_directory / paths.ANSWERS_FOLDER / paths.QUERY_HASHES_FILE).read_text())
    stale = []
    for name, current_hash in query_hashes(queries_folder).items():
        if recorded.get(name) != current_hash:
            stale.append(name)
    return stale


def query_text_hash(queries_folder: pathlib.Path, name: str) -> str:
    """The SHA-256, as hex, of the bytes of the query `name`, the file `<queries_folder>/<name>.sql`."""
    return hashlib.sha256((queries_folder / f"{name}.sql").read_bytes()).hexdigest()


def answered_rows(connection: duckdb.DuckDBPyConnection, query_name: str, selection: DefaultSelection,
                  harness_list: list[str]) -> list[dict]:
    """The query's answer rows under the default selection the selection tables hold, or, for one of
    `EVERY_HARNESS_QUERIES`, under its weeks and every harness of `harness_list`, the tables then holding the default
    selection again."""
    if query_name not in EVERY_HARNESS_QUERIES:
        return answer_rows(connection, query_name)
    site_database.select_weeks(connection, selection.weeks, harness_list)
    rows = answer_rows(connection, query_name)
    site_database.select_weeks(connection, selection.weeks, selection.harnesses)
    return rows


def answer_rows(connection: duckdb.DuckDBPyConnection, query_name: str) -> list[dict]:
    """The rows of the query, each a dict from the query's column names, in its order, to the row's JSON values."""
    result = site_database.query_rows(connection, query_name)
    rows = []
    for row in result.rows:
        values = [json_value(value) for value in row]
        rows.append(dict(zip(result.columns, values)))
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
    return json.dumps(rows, separators=paths.JSON_SEPARATORS, allow_nan=False) + "\n"
