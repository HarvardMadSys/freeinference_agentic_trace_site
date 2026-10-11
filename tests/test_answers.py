"""The answers the data step writes for the default selection equal the queries run live with that selection, and
every Explore and figure query, and every colour order, has one."""

import json
import math
import pathlib

import duckdb
import pandas
import pytest

import site_data.__main__
import site_data.answers

import fixture_release
import site_database

ANSWERS_FOLDER = "all_weeks"  # where the data step writes the answers, under the data folder
ANSWERED_PAGES = ("explore/", "figures/")  # the pages whose queries are answered
# The colour orders, answered too: they read every week and every harness, whatever the selection.
COLOUR_ORDER_QUERIES = ["setup/category_order", "setup/harness_order", "setup/model_order"]
RELATIVE_TOLERANCE = 1e-12  # an answer's number and the live query's are equal when this close
# The queries that read the `simulation` view, which a data folder with no simulated week does not have.
SIMULATION_QUERIES = ["figures/dead_over_active_by_policy", "figures/simulated_hit_ratio_by_ttl"]
FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]


def answered_query_names() -> list[str]:
    """Every query under `explore/` and `figures/`, and every colour order, by name, sorted."""
    page_queries = [name for name in site_database.query_names() if name.startswith(ANSWERED_PAGES)]
    return sorted([*page_queries, *COLOUR_ORDER_QUERIES])


def expected_answer_names(data_directory: pathlib.Path) -> list[str]:
    """The queries the data folder has an answer of: every answered query, but when `weeks.json` marks no week
    simulated, none of the simulation's."""
    entries = json.loads((data_directory / "weeks.json").read_text())
    if any(entry["simulated"] for entry in entries):
        return answered_query_names()
    return [name for name in answered_query_names() if name not in SIMULATION_QUERIES]


def answer_files(names: list[str]) -> list[str]:
    """The answer file of each query, by its path relative to the answers folder: `<folder>/<query>.json`."""
    return [f"{name}.json" for name in names]


def written_files(data_directory: pathlib.Path) -> list[str]:
    """Every file under the answers folder, by its path relative to it, sorted."""
    folder = data_directory / ANSWERS_FOLDER
    return sorted(path.relative_to(folder).as_posix() for path in folder.rglob("*") if path.is_file())


def read_answer(data_directory: pathlib.Path, name: str) -> list[dict]:
    """The rows of the query's answer file."""
    return json.loads((data_directory / ANSWERS_FOLDER / f"{name}.json").read_text())


def same_value(answered: object, live: object) -> bool:
    """Whether an answer's value equals the live query's: null for a NaN or None, a string exactly, a number within
    `RELATIVE_TOLERANCE`."""
    if pandas.isna(live):
        return answered is None
    if isinstance(live, str):
        return answered == live
    if answered is None or isinstance(answered, str):
        return False
    return math.isclose(answered, live, rel_tol=RELATIVE_TOLERANCE)


@pytest.mark.parametrize("name", answered_query_names())
def test_an_answer_equals_its_query_run_live_with_the_default_selection(
        connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path, name: str) -> None:
    selection = site_data.answers.default_selection(data_directory)
    site_database.select_weeks(connection, selection.weeks, selection.harnesses)
    live = site_database.run_query(connection, name)
    answer = read_answer(data_directory, name)
    assert len(answer) == len(live), f"{name}: {len(answer)} rows answered, {len(live)} live"
    for index, live_row in enumerate(live.itertuples(index=False)):
        answered_row = answer[index]
        assert list(answered_row) == list(live.columns), f"{name} row {index}: columns {list(answered_row)}"
        for column, answered_value, live_value in zip(live.columns, answered_row.values(), live_row):
            assert same_value(answered_value, live_value), \
                f"{name} row {index} {column}: {answered_value!r} answered, {live_value!r} live"


def test_every_explore_and_figure_query_and_colour_order_has_an_answer_and_nothing_else_does(data_directory: pathlib.Path) -> None:
    assert written_files(data_directory) == answer_files(expected_answer_names(data_directory))


@pytest.mark.parametrize("name", COLOUR_ORDER_QUERIES)
def test_a_colour_order_is_its_answer_whatever_the_selection(connection: duckdb.DuckDBPyConnection,
                                                             data_directory: pathlib.Path, name: str) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], ["pi"])
    live = site_database.run_query(connection, name)
    assert live.to_dict("records") == read_answer(data_directory, name)


def test_the_harness_order_reads_every_harness_whatever_the_selection(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], ["pi"])
    assert len(site_database.run_query(connection, "setup/harness_order")) == len(fixture_release.EVERY_HARNESS)


def test_the_default_selection_is_every_week_and_every_harness_but_the_benchmark_s(
        data_directory: pathlib.Path) -> None:
    selection = site_data.answers.default_selection(data_directory)
    assert selection.weeks == [FIRST_SUNDAY, SECOND_SUNDAY]
    assert sorted(selection.harnesses) == sorted(fixture_release.PAPER_HARNESSES)


# 13 top-level requests of the paper's harnesses, counted by hand in tests/test_queries.py.
def test_an_answer_is_one_line_of_json_with_integers_kept_integers(data_directory: pathlib.Path) -> None:
    text = (data_directory / ANSWERS_FOLDER / "explore" / "request_count.json").read_text()
    assert text == '[{"requests":13}]\n'


def test_a_nan_is_written_as_null_and_an_infinity_stops_the_writer() -> None:
    assert site_data.answers.answer_text([{"share": site_data.answers.json_value(math.nan)}]) == '[{"share":null}]\n'
    with pytest.raises(ValueError):
        site_data.answers.answer_text([{"share": math.inf}])


def test_without_a_simulated_week_only_the_simulation_queries_have_no_answer(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    (tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json").write_text(json.dumps({}))
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(tmp_path / "data")])
    written = written_files(tmp_path / "data")
    assert written == answer_files(expected_answer_names(tmp_path / "data"))
    assert sorted(set(answer_files(answered_query_names())) - set(written)) == answer_files(SIMULATION_QUERIES)
    connection = site_database.open_site_database(tmp_path / "data")
    for name in SIMULATION_QUERIES:
        with pytest.raises(duckdb.CatalogException, match="simulation"):
            site_database.run_query(connection, name)
    connection.close()
