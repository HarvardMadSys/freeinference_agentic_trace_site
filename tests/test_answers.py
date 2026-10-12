"""The answers the data step writes for the default selection equal the queries run live with that selection, the
sessions table's run with every harness and marking the benchmark's, every Explore and figure query, and every colour
order, has one, the hash of each one's text is recorded so a query edited
since is found, and a failed run leaves the previous answers in place."""

import json
import math
import pathlib
import shutil

import duckdb
import pandas
import pytest

import site_data.__main__
import site_data.answers
import site_data.check_answers
import site_data.paths
import site_data.site_database

import fixture_release
import site_database

RELATIVE_TOLERANCE = 1e-12  # an answer's number and the live query's are equal when this close
# The queries that read the `simulation` view, which a data folder with no simulated week does not have.
SIMULATION_QUERIES = ["figures/prefill_against_storage"]
SHIPPED_DATA_FOLDER = site_database.QUERIES_FOLDER.parent / "data"  # the data the repository tracks, built by `make data`
FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]


def expected_answer_names(data_directory: pathlib.Path) -> list[str]:
    """The queries the data folder has an answer of: every answered query, but when `weeks.json` marks no week
    simulated, none of the simulation's."""
    entries = json.loads((data_directory / "weeks.json").read_text())
    if any(entry["simulated"] for entry in entries):
        return site_data.answers.answered_query_names()
    return [name for name in site_data.answers.answered_query_names() if name not in SIMULATION_QUERIES]


def answer_files(names: list[str]) -> list[str]:
    """The answer file of each query, by its path relative to the answers folder: `<folder>/<query>.json`."""
    return [f"{name}.json" for name in names]


def answers_folder_files(names: list[str]) -> list[str]:
    """What the answers folder holds when `names` are answered: their answer files and the query hashes, sorted."""
    return sorted([*answer_files(names), site_data.paths.QUERY_HASHES_FILE])


def written_files(data_directory: pathlib.Path) -> list[str]:
    """Every file under the answers folder, by its path relative to it, sorted."""
    folder = data_directory / site_data.paths.ANSWERS_FOLDER
    return sorted(path.relative_to(folder).as_posix() for path in folder.rglob("*") if path.is_file())


def read_answer(data_directory: pathlib.Path, name: str) -> list[dict]:
    """The rows of the query's answer file."""
    return json.loads((data_directory / site_data.paths.ANSWERS_FOLDER / f"{name}.json").read_text())


def same_value(answered: object, live: object) -> bool:
    """Whether an answer's value equals the live query's: null for a NaN or None, a string exactly, a number within
    `RELATIVE_TOLERANCE`.

    An integer written as a float (`13.0` for `13`) passes `isclose`; the test of an answer's exact text guards that.
    """
    if pandas.isna(live):
        return answered is None
    if isinstance(live, str):
        return answered == live
    if answered is None or isinstance(answered, str):
        return False
    return math.isclose(answered, live, rel_tol=RELATIVE_TOLERANCE)


@pytest.mark.parametrize("name", site_data.answers.answered_query_names())
def test_an_answer_equals_its_query_run_live_with_the_selection_it_was_answered_with(
        connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path, name: str) -> None:
    selection = site_data.answers.default_selection(data_directory)
    harness_list = selection.harnesses
    if name == site_data.answers.EVERY_HARNESS_QUERY:
        harness_list = site_data.answers.every_harness(data_directory)
    site_database.select_weeks(connection, selection.weeks, harness_list)
    live = site_database.run_query(connection, name)
    answer = read_answer(data_directory, name)
    assert len(live) > 0, f"{name}: no rows on the fixture, so its columns and values go unchecked"
    assert len(answer) == len(live), f"{name}: {len(answer)} rows answered, {len(live)} live"
    for index, live_row in enumerate(live.itertuples(index=False)):
        answered_row = answer[index]
        assert list(answered_row) == list(live.columns), f"{name} row {index}: columns {list(answered_row)}"
        for column, answered_value, live_value in zip(live.columns, answered_row.values(), live_row):
            assert same_value(answered_value, live_value), \
                f"{name} row {index} {column}: {answered_value!r} answered, {live_value!r} live"


def test_every_explore_and_figure_query_and_colour_order_has_an_answer_and_nothing_else_does(data_directory: pathlib.Path) -> None:
    assert site_data.answers.ANSWERED_PAGES == ["explore", "figures"]
    assert written_files(data_directory) == answers_folder_files(expected_answer_names(data_directory))


@pytest.mark.parametrize("name", site_data.answers.COLOUR_ORDER_QUERIES)
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


def test_the_sessions_table_s_answer_holds_every_harness_s_sessions_with_the_benchmark_s_marked(
        data_directory: pathlib.Path) -> None:
    assert site_data.answers.EVERY_HARNESS_QUERY == "explore/sessions_of_selection"
    assert sorted(site_data.answers.every_harness(data_directory)) == sorted(fixture_release.EVERY_HARNESS)
    answer = read_answer(data_directory, site_data.answers.EVERY_HARNESS_QUERY)
    assert {row["session_id"]: (row["harness"], row["benchmark"]) for row in answer} == {
        "tree-root": ("claude-code", False), "mutation": ("codex", False), "idle-week-1": ("pi", False),
        "idle-week-2": ("pi", False), "swe-bench": ("eval:swe-bench", True), "idle-benchmark": ("eval:swe-bench", True),
    }


def test_after_the_sessions_table_s_answer_the_next_query_is_answered_with_the_default_selection_again(
        data_directory: pathlib.Path) -> None:
    names = site_data.answers.answered_query_names()
    after = names[names.index(site_data.answers.EVERY_HARNESS_QUERY) + 1]
    assert after == "explore/sessions_per_week_by_harness"
    harnesses_answered = {row["harness"] for row in read_answer(data_directory, after)}
    assert sorted(harnesses_answered) == sorted(fixture_release.PAPER_HARNESSES)


# 13 top-level requests of the paper's harnesses, counted by hand in tests/test_queries.py.
def test_an_answer_is_one_line_of_json_with_integers_kept_integers(data_directory: pathlib.Path) -> None:
    text = (data_directory / site_data.paths.ANSWERS_FOLDER / "explore" / "request_count.json").read_text()
    assert text == '[{"requests":13}]\n'


def test_a_nan_is_written_as_null_and_an_infinity_stops_the_writer() -> None:
    assert site_data.answers.answer_text([{"share": site_data.answers.json_value(math.nan)}]) == '[{"share":null}]\n'
    with pytest.raises(ValueError):
        site_data.answers.answer_text([{"share": math.inf}])


def test_without_a_simulated_week_only_the_simulation_queries_have_no_answer(
        tmp_path: pathlib.Path, capsys: pytest.CaptureFixture) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    (tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json").write_text(json.dumps({}))
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(tmp_path / "data")])
    unanswered = []
    for line in capsys.readouterr().out.splitlines():
        if line.endswith(": no answer, because no week is simulated"):
            unanswered.append(line.split(":")[0])
    assert unanswered == SIMULATION_QUERIES
    written = written_files(tmp_path / "data")
    assert written == answers_folder_files(expected_answer_names(tmp_path / "data"))
    every_answer = answers_folder_files(site_data.answers.answered_query_names())
    assert sorted(set(every_answer) - set(written)) == answer_files(SIMULATION_QUERIES)
    assert site_data.check_answers.stale_queries(tmp_path / "data") == []
    connection = site_database.open_site_database(tmp_path / "data")
    for name in SIMULATION_QUERIES:
        with pytest.raises(duckdb.CatalogException, match="simulation"):
            site_database.run_query(connection, name)
    connection.close()


def test_the_answers_record_the_hash_of_each_answered_query_s_text(data_directory: pathlib.Path) -> None:
    hashes_path = data_directory / site_data.paths.ANSWERS_FOLDER / site_data.paths.QUERY_HASHES_FILE
    recorded = json.loads(hashes_path.read_text())
    assert sorted(recorded) == site_data.answers.answered_query_names()
    assert recorded == site_data.answers.query_hashes()
    assert site_data.check_answers.stale_queries(data_directory) == []


def test_the_check_prints_how_many_queries_the_answers_match(data_directory: pathlib.Path,
                                                             capsys: pytest.CaptureFixture) -> None:
    site_data.check_answers.main(["--data", str(data_directory)])
    count = len(site_data.answers.answered_query_names())
    assert capsys.readouterr().out == f"answers match {count} queries\n"


def test_a_query_edited_or_added_since_make_data_fails_the_check(data_directory: pathlib.Path,
                                                                 tmp_path: pathlib.Path) -> None:
    queries = tmp_path / "queries"
    shutil.copytree(site_data.site_database.QUERIES_FOLDER, queries)
    with (queries / "explore" / "request_count.sql").open("a") as query:
        query.write("-- edited\n")
    (queries / "figures" / "added_since.sql").write_text("SELECT 1 AS one;\n")
    assert site_data.check_answers.stale_queries(data_directory, queries) == [
        site_data.check_answers.StaleQuery(name="explore/request_count", reason=site_data.check_answers.CHANGED),
        site_data.check_answers.StaleQuery(name="figures/added_since", reason=site_data.check_answers.UNRECORDED),
    ]


def test_the_check_fails_and_names_each_stale_query(data_directory: pathlib.Path, tmp_path: pathlib.Path,
                                                    capsys: pytest.CaptureFixture) -> None:
    data = tmp_path / "data"
    shutil.copytree(data_directory / site_data.paths.ANSWERS_FOLDER, data / site_data.paths.ANSWERS_FOLDER)
    hashes_path = data / site_data.paths.ANSWERS_FOLDER / site_data.paths.QUERY_HASHES_FILE
    recorded = json.loads(hashes_path.read_text())
    recorded["explore/request_count"] = "0" * 64
    hashes_path.write_text(json.dumps(recorded))
    with pytest.raises(SystemExit) as exit_info:
        site_data.check_answers.main(["--data", str(data)])
    assert exit_info.value.code == 1
    assert f"explore/request_count: {site_data.check_answers.CHANGED}" in capsys.readouterr().err


def test_without_recorded_hashes_the_check_says_to_run_make_data(tmp_path: pathlib.Path,
                                                                capsys: pytest.CaptureFixture) -> None:
    with pytest.raises(SystemExit) as exit_info:
        site_data.check_answers.main(["--data", str(tmp_path)])
    assert exit_info.value.code == 1
    assert "run make data first" in capsys.readouterr().err


def test_a_failed_run_leaves_the_previous_answers_in_place(data_directory: pathlib.Path, tmp_path: pathlib.Path,
                                                           monkeypatch: pytest.MonkeyPatch) -> None:
    data = tmp_path / "data"
    shutil.copytree(data_directory, data)
    before = written_files(data)

    def fail(rows: list[dict]) -> str:
        raise RuntimeError("a query failed")

    monkeypatch.setattr(site_data.answers, "answer_text", fail)
    with pytest.raises(RuntimeError):
        site_data.answers.write_answers(data)
    assert written_files(data) == before
    assert read_answer(data, "explore/request_count") == read_answer(data_directory, "explore/request_count")


def test_shipped_answers_come_from_the_current_queries() -> None:
    """Every answer under the tracked `site/data` was written from its query's current text: a query edited since `make
    data`, or added since, fails here until `make data` is rerun."""
    stale = site_data.check_answers.stale_queries(SHIPPED_DATA_FOLDER)
    assert stale == [], "stale answers: " + ", ".join(f"{query.name} ({query.reason})" for query in stale)
