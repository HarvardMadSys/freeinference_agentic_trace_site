"""The answers the data step writes for the default selection equal the queries run live with that selection, the
sessions table's run with every harness and marking the benchmark's, every Explore and figure query, and every colour
order, has one, even without a simulated week, and the hash of each one's text is recorded so a query edited since is
found."""

import json
import math
import pathlib
import shutil

import duckdb
import pandas
import pytest

import site_data.__main__
import site_data.answers
import site_data.buckets
import site_data.paths
import site_data.site_database

import fixture_release
import site_database

RELATIVE_TOLERANCE = 1e-12  # an answer's number and the live query's are equal when this close
# The queries that read the `simulation` table, which has no rows when no week is simulated.
SIMULATION_QUERIES = [
    "figures/api_cost_by_ttl", "figures/infrastructure_cost_by_ttl", "figures/prefill_against_storage",
]
SHIPPED_DATA_FOLDER = site_database.QUERIES_FOLDER.parent / "data"  # the data the repository tracks, built by `make data`
FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
SESSIONS_TABLE_QUERY = "explore/sessions_of_selection"  # the Session Explorer's answer, every harness's sessions
TRACE_TOTALS_QUERY = "explore/trace_totals"  # the stats strip's answer, the whole trace
FIRST_PAGE_QUERY = "explore/sessions_first_page"  # the Session Explorer's first page, before its full list
# The Overview's answers, which count every harness as the stats strip does.
OVERVIEW_QUERIES = ["explore/model_mix", "explore/requests_per_week_by_model", "explore/input_tokens_per_week",
                    "explore/sessions_per_week_by_harness"]


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
    if name in site_data.answers.EVERY_HARNESS_QUERIES:
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
    assert written_files(data_directory) == answers_folder_files(site_data.answers.answered_query_names())


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
    assert SESSIONS_TABLE_QUERY in site_data.answers.EVERY_HARNESS_QUERIES
    assert sorted(site_data.answers.every_harness(data_directory)) == sorted(fixture_release.EVERY_HARNESS)
    answer = read_answer(data_directory, SESSIONS_TABLE_QUERY)
    assert {row["session_id"]: (row["harness"], row["benchmark"]) for row in answer} == {
        "tree-root": ("claude-code", False), "mutation": ("codex", False), "idle-week-1": ("pi", False),
        "idle-week-2": ("pi", False), "swe-bench": ("eval:swe-bench", True), "idle-benchmark": ("eval:swe-bench", True),
    }


def test_the_overview_and_the_session_explorer_are_answered_over_every_harness_and_the_figures_over_the_paper_s() -> None:
    every_harness = site_data.answers.EVERY_HARNESS_QUERIES
    assert sorted(every_harness) == sorted(OVERVIEW_QUERIES + [SESSIONS_TABLE_QUERY, FIRST_PAGE_QUERY,
                                                                TRACE_TOTALS_QUERY])
    assert not any(name.startswith("figures/") for name in every_harness)


def test_after_an_answer_over_every_harness_the_next_query_is_answered_with_the_default_selection_again(
        data_directory: pathlib.Path) -> None:
    names = site_data.answers.answered_query_names()
    after = names[names.index("explore/sessions_per_week_by_harness") + 1]
    assert after not in site_data.answers.EVERY_HARNESS_QUERIES
    harness_answer = read_answer(data_directory, "explore/sessions_per_week_by_harness")
    assert sorted({row["harness"] for row in harness_answer}) == sorted(fixture_release.EVERY_HARNESS)
    [stats] = read_answer(data_directory, after.replace("_bins", "_stats"))
    listed = read_answer(data_directory, SESSIONS_TABLE_QUERY)
    assert stats["count"] == len([row for row in listed if not row["benchmark"]])


def test_the_donuts_count_what_the_stats_strip_counts(data_directory: pathlib.Path) -> None:
    for data_folder in [data_directory, SHIPPED_DATA_FOLDER]:
        [totals] = read_answer(data_folder, TRACE_TOTALS_QUERY)
        sessions = sum(row["sessions"] for row in read_answer(data_folder, "explore/sessions_per_week_by_harness"))
        requests = sum(row["requests"] for row in read_answer(data_folder, "explore/model_mix"))
        assert (sessions, requests) == (totals["sessions"], totals["requests"]), data_folder


def test_the_first_page_is_the_session_list_s_newest_twenty_with_its_count(data_directory: pathlib.Path) -> None:
    for data_folder in [data_directory, SHIPPED_DATA_FOLDER]:
        listed = read_answer(data_folder, SESSIONS_TABLE_QUERY)
        first_page = read_answer(data_folder, FIRST_PAGE_QUERY)
        newest = sorted(listed, key=lambda row: -row["first_start_ms"])[:20]
        assert [row["session_id"] for row in first_page] == [row["session_id"] for row in newest], data_folder
        assert {row["total_sessions"] for row in first_page} == {len(listed)}, data_folder


def test_the_trace_totals_count_the_sessions_the_session_explorer_lists_and_the_harnesses_the_index_lists(
        data_directory: pathlib.Path) -> None:
    for data_folder in [data_directory, SHIPPED_DATA_FOLDER]:
        [totals] = read_answer(data_folder, TRACE_TOTALS_QUERY)
        assert totals["sessions"] == len(read_answer(data_folder, SESSIONS_TABLE_QUERY)), data_folder
        assert totals["benchmark_harnesses"] == 1, data_folder
        listed_harnesses = json.loads((data_folder / site_data.paths.HARNESSES_FILE).read_text())
        benchmarks = [entry for entry in listed_harnesses if entry["benchmark"]]
        assert totals["harnesses"] == len(listed_harnesses), data_folder
        assert totals["benchmark_harnesses"] == len(benchmarks), data_folder


# The whole fixture's totals, counted by hand in tests/test_explore_queries.py.
def test_an_answer_is_one_line_of_json_with_integers_kept_integers(data_directory: pathlib.Path) -> None:
    text = (data_directory / site_data.paths.ANSWERS_FOLDER / "explore" / "trace_totals.json").read_text()
    assert text == ('[{"sessions":6,"requests":16,"input_tokens":28500,"output_tokens":1600,"cached_tokens":15400,'
                    '"tool_calls":12,"harnesses":4,"benchmark_harnesses":1}]\n')


def test_a_nan_is_written_as_null_and_an_infinity_stops_the_writer() -> None:
    assert site_data.answers.answer_text([{"share": site_data.answers.json_value(math.nan)}]) == '[{"share":null}]\n'
    with pytest.raises(ValueError):
        site_data.answers.answer_text([{"share": math.inf}])


def test_without_a_simulated_week_every_query_has_an_answer(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    (tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json").write_text(json.dumps({}))
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(tmp_path / "data")])
    assert written_files(tmp_path / "data") == answers_folder_files(site_data.answers.answered_query_names())
    for name in SIMULATION_QUERIES:
        assert read_answer(tmp_path / "data", name) == [], name
    assert site_data.answers.stale_queries(tmp_path / "data") == []


def test_the_answers_record_the_hash_of_each_answered_query_s_text(data_directory: pathlib.Path) -> None:
    hashes_path = data_directory / site_data.paths.ANSWERS_FOLDER / site_data.paths.QUERY_HASHES_FILE
    recorded = json.loads(hashes_path.read_text())
    assert sorted(recorded) == sorted([*site_data.answers.answered_query_names(),
                                       *site_data.buckets.BUCKET_PARTS.values(),
                                       *site_data.site_database.SELECTION_VIEW_STATEMENTS])
    assert recorded == site_data.answers.query_hashes()


def test_a_query_or_view_edited_or_added_since_make_data_is_stale(data_directory: pathlib.Path,
                                                                  tmp_path: pathlib.Path) -> None:
    queries = tmp_path / "queries"
    shutil.copytree(site_data.site_database.QUERIES_FOLDER, queries)
    with (queries / "explore" / "trace_totals.sql").open("a") as query:
        query.write("-- edited\n")
    (queries / "figures" / "added_since.sql").write_text("SELECT 1 AS one;\n")
    with (queries / "setup" / "create_view_session_time.sql").open("a") as view:
        view.write("-- edited\n")
    assert site_data.answers.stale_queries(data_directory, queries) == [
        "explore/trace_totals", "figures/added_since", "setup/create_view_session_time",
    ]


def test_shipped_answers_come_from_the_current_queries() -> None:
    """Every answer under the tracked `site/data` was written from its query's current text: a query edited since `make
    data`, or added since, fails here until `make data` is rerun."""
    stale = site_data.answers.stale_queries(SHIPPED_DATA_FOLDER)
    assert stale == [], "edited or added since make data last ran, so rerun it: " + ", ".join(stale)
