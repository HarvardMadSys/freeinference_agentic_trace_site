"""The database over the fixture's frames, set up as the data step sets it up: each frame is the table of its name,
and the benchmark harness table holds the index's benchmark."""

import pathlib

import duckdb

import site_data.__main__
import site_data.loading
import site_data.weeks

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


def test_each_table_s_week_is_a_string(connection: duckdb.DuckDBPyConnection) -> None:
    for table in ["requests", "tool_calls", "sessions", "simulation"]:
        rows = connection.table(table)
        assert dict(zip(rows.columns, rows.types))["week"] == "VARCHAR", table
    weeks = connection.table("requests").df().week
    assert sorted(weeks.unique().tolist()) == [FIRST_SUNDAY, SECOND_SUNDAY]


def test_each_table_holds_the_rows_of_every_week_and_the_simulation_those_of_the_simulated_week(
        connection: duckdb.DuckDBPyConnection) -> None:
    sessions = connection.table("sessions").df()
    assert sessions.groupby("week").size().to_dict() == {FIRST_SUNDAY: 6, SECOND_SUNDAY: 3}
    assert connection.table("requests").df().groupby("week").size().to_dict() == {FIRST_SUNDAY: 15, SECOND_SUNDAY: 6}
    assert connection.table("simulation").df().week.unique().tolist() == [FIRST_SUNDAY]  # the one simulated week


def test_the_benchmark_session_s_rows_are_in_the_views(connection: duckdb.DuckDBPyConnection) -> None:
    requests = connection.table("requests").df()
    assert requests[requests.session_id == "swe-bench"].harness.tolist() == ["eval:swe-bench"] * 2
    sessions = connection.table("sessions").df()
    assert sessions[sessions.harness == "eval:swe-bench"].session_id.tolist() == ["swe-bench", "idle-benchmark"]


def test_nullable_integers_and_booleans_keep_their_types(connection: duckdb.DuckDBPyConnection) -> None:
    requests = connection.table("requests")
    types = dict(zip(requests.columns, [str(column_type) for column_type in requests.types]))
    assert [types[column] for column in ["ttft_ms", "idle_gap_bin", "user_prompt_tokens", "missed_tokens_no_ttl"]] == [
        "BIGINT"] * 4
    assert types["is_top_level"] == "BOOLEAN"


def test_the_benchmark_harness_table_holds_the_index_s_benchmark(connection: duckdb.DuckDBPyConnection) -> None:
    assert connection.table("benchmark_harness").fetchall() == [("eval:swe-bench",)]


def test_the_idle_gaps_are_those_counted_by_hand(connection: duckdb.DuckDBPyConnection) -> None:
    requests = connection.table("requests").df().set_index(["session_id", "step"])
    with_gap = requests[requests.idle_gap_s.notna()]
    assert with_gap.idle_gap_s.to_dict() == FIXTURE_IDLE_GAPS


def test_without_a_simulated_week_the_simulation_is_an_empty_table_with_every_column(
        tmp_path: pathlib.Path, connection: duckdb.DuckDBPyConnection) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    (tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json").write_text("{}")
    entries = site_data.weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = site_data.loading.load_release(tmp_path / "release", entries)
    frames = site_data.__main__.site_frames(release, tmp_path / "simulation", entries)
    assert len(frames.requests) == 21
    assert len(frames.simulation) == 0
    assert list(frames.simulation.columns) == connection.table("simulation").columns
