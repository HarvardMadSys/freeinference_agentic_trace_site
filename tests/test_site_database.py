"""The database over the fixture's data folder, set up as the browser sets it up: each view reads its kind's week
files with the week taken from the folder name, and the benchmark harness table holds the index's benchmark."""

import json
import pathlib

import duckdb
import pandas
import pytest

import site_data.__main__
import site_data.site_database

import fixture_release

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]

# Every idle gap of the fixture's top-level requests, by session and step, counted by hand from
# `fixture_release.REQUESTS`: a request's start minus the latest end of the same user's earlier top-level requests at
# its provider in its scope, in seconds. `idle-week-2`'s first gap reaches back across the week boundary to
# `idle-week-1`, not to `idle-benchmark`, of the other scope; `swe-bench`'s provider reports no cache reads, and the
# first request of a user at a provider has no gap, so neither has one.
FIXTURE_IDLE_GAPS = {
    ("idle-week-1", 1): 20.0, ("idle-week-1", 2): 5.0,
    ("idle-week-2", 0): 4_800.0, ("idle-week-2", 1): 90.0,
    ("mutation", 1): 10.0, ("mutation", 2): 170.0,
    ("tree-root", 1): 10.0, ("tree-root", 2): 70.0, ("tree-root", 3): 10.0, ("tree-root", 4): 170.0,
}


def test_the_week_is_read_from_the_folder_name_as_a_string(connection: duckdb.DuckDBPyConnection) -> None:
    for view in ["requests", "tool_calls", "sessions", "simulation"]:
        rows = connection.table(view)
        assert dict(zip(rows.columns, rows.types))["week"] == "VARCHAR", view
    weeks = connection.table("requests").df().week
    assert sorted(weeks.unique().tolist()) == [FIRST_SUNDAY, SECOND_SUNDAY]


def test_each_view_holds_the_rows_of_every_week_that_has_its_file(connection: duckdb.DuckDBPyConnection) -> None:
    sessions = connection.table("sessions").df()
    assert sessions.groupby("week").size().to_dict() == {FIRST_SUNDAY: 6, SECOND_SUNDAY: 3}
    assert connection.table("requests").df().groupby("week").size().to_dict() == {FIRST_SUNDAY: 15, SECOND_SUNDAY: 6}
    assert connection.table("simulation").df().week.unique().tolist() == [FIRST_SUNDAY]  # the one simulated week


def test_the_benchmark_session_s_rows_are_in_the_views(connection: duckdb.DuckDBPyConnection) -> None:
    requests = connection.table("requests").df()
    assert requests[requests.session_id == "swe-bench"].harness.tolist() == ["eval:swe-bench"] * 2
    sessions = connection.table("sessions").df()
    assert sessions[sessions.harness == "eval:swe-bench"].session_id.tolist() == ["swe-bench", "idle-benchmark"]


def test_the_benchmark_harness_table_holds_the_index_s_benchmark(connection: duckdb.DuckDBPyConnection) -> None:
    assert connection.table("benchmark_harness").fetchall() == [("eval:swe-bench",)]


def test_the_idle_gaps_are_those_counted_by_hand(connection: duckdb.DuckDBPyConnection) -> None:
    requests = connection.table("requests").df().set_index(["session_id", "step"])
    with_gap = requests[requests.idle_gap_s.notna()]
    assert with_gap.idle_gap_s.to_dict() == FIXTURE_IDLE_GAPS


def test_a_data_folder_without_a_simulated_week_has_no_simulation_view_and_its_other_views(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    (tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json").write_text(json.dumps({}))
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(tmp_path / "data")])
    connection = site_data.site_database.open_site_database(tmp_path / "data")
    assert len(connection.table("requests").df()) == 21
    with pytest.raises(duckdb.CatalogException, match="simulation"):
        connection.table("simulation")
    connection.close()


def test_a_quote_in_a_file_name_is_doubled() -> None:
    assert site_data.site_database.quoted_list(["a/week=1/rows.parquet", "it's"]) == "'a/week=1/rows.parquet', 'it''s'"


def test_the_files_listed_are_the_kind_s_week_files_in_week_order(data_directory: pathlib.Path) -> None:
    files = site_data.site_database.week_files(data_directory, "requests", [FIRST_SUNDAY, SECOND_SUNDAY])
    assert files == [str(data_directory / "requests" / f"week={week}" / "rows.parquet")
                     for week in [FIRST_SUNDAY, SECOND_SUNDAY]]
    assert all(pandas.read_parquet(name).shape[0] > 0 for name in files)
