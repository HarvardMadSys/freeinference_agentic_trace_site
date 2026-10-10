"""The fixture release is a release the pipeline's reader accepts, with a simulation of its first week only."""

import pathlib

import pandas
from release import reader
from simulation import weekly_files

import fixture_release


def loaded_fixture(tmp_path: pathlib.Path) -> reader.Release:
    """The fixture release, written under tmp_path and loaded by the pipeline's reader."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    return reader.load(tmp_path / "release")


def test_the_reader_loads_every_week(tmp_path: pathlib.Path) -> None:
    release = loaded_fixture(tmp_path)
    assert (len(release.sessions), len(release.requests), len(release.tool_calls)) == (9, 21, 16)


def test_each_week_holds_its_own_sessions(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    second_week = reader.load(tmp_path / "release", weeks=["2026-06-07"])
    assert sorted(second_week.sessions.session_id) == ["idle-benchmark", "idle-week-2", "mutation"]
    assert (len(second_week.requests), len(second_week.tool_calls)) == (6, 2)


def test_the_nested_subagent_points_at_its_parent(tmp_path: pathlib.Path) -> None:
    sessions = loaded_fixture(tmp_path).sessions.set_index("session_id")
    assert sessions.parent_session_id["tree-grandchild"] == "tree-child"
    assert sessions.parent_session_id["tree-child"] == "tree-root"


def test_the_two_subagents_overlap_in_time(tmp_path: pathlib.Path) -> None:
    requests = loaded_fixture(tmp_path).requests.set_index(["session_id", "step"])
    child, sibling = requests.loc[("tree-child", 0)], requests.loc[("tree-sibling", 0)]
    assert sibling.start_ms < child.end_ms and child.start_ms < sibling.end_ms


def test_a_step_is_tool_triggered_exactly_when_the_step_before_called_tools(tmp_path: pathlib.Path) -> None:
    release = loaded_fixture(tmp_path)
    called = set(zip(release.tool_calls.session_id, release.tool_calls.step))
    for session_id, step, step_trigger in zip(release.requests.session_id, release.requests.step,
                                              release.requests.step_trigger):
        if step > 0:
            assert (step_trigger == "tool") == ((session_id, step - 1) in called), (session_id, step)
    assert (release.requests.step_trigger == "tool").sum() == 11


def test_only_the_benchmark_session_reports_no_cache_reads(tmp_path: pathlib.Path) -> None:
    requests = loaded_fixture(tmp_path).requests
    unreported = requests[requests.cache_read_tokens.isna()]
    assert unreported.session_id.tolist() == ["swe-bench", "swe-bench"]


def test_only_the_first_week_is_simulated(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    assert [path.name for path in (tmp_path / "simulation").iterdir()] == ["2026-05-31_2026-06-06"]
    simulated_week = tmp_path / "simulation" / "2026-05-31_2026-06-06"
    tallies = pandas.read_parquet(simulated_week / weekly_files.TALLIES_FILE)
    totals = pandas.read_parquet(simulated_week / weekly_files.TOTALS_FILE)
    assert list(tallies.columns) == ["scope", "policy", "ttl", *weekly_files.TALLY_COLUMNS]
    assert list(totals.columns) == ["scope", *weekly_files.TOTAL_COLUMNS]


def test_the_simulation_records_the_manifest_it_was_computed_from(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    week = "2026-05-31_2026-06-06"
    sources = weekly_files.recorded_sources(tmp_path / "simulation" / week)
    current = weekly_files.traces_source(tmp_path / "release" / week)
    assert sources == {weekly_files.TALLIES_FILE: current, weekly_files.TOTALS_FILE: current}
