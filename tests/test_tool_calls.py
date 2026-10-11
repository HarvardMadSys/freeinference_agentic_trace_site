"""The site's tool calls on the fixture release: each joins its request and carries its session's place."""

import dataclasses
import pathlib

import pandas
import pytest

from site_data import loading, requests, simulation, tool_calls, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "session_id", "step", "call_index", "name", "category", "programs", "arguments_skeleton", "outcome",
    "result_tokens", "latency_ms", "harness", "is_top_level", "root_session_id",
]


def fixture_release_and_requests(tmp_path: pathlib.Path) -> tuple[loading.WeekTaggedRelease, pandas.DataFrame]:
    """The loaded fixture release and the site's requests of it."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries)
    request_misses = simulation.request_misses_frame(tmp_path / "simulation", entries)
    return release, requests.requests_frame(release, request_misses)


def fixture_calls(tmp_path: pathlib.Path) -> pandas.DataFrame:
    """The site's tool calls of the fixture release, indexed by session, step and call index."""
    release, site_requests = fixture_release_and_requests(tmp_path)
    calls = tool_calls.tool_calls_frame(release, site_requests)
    return calls.set_index(["session_id", "step", "call_index"], drop=False)


def test_every_call_is_a_row_with_the_site_s_columns(tmp_path: pathlib.Path) -> None:
    calls = fixture_calls(tmp_path)
    assert len(calls) == 16
    assert list(calls.columns) == SITE_COLUMNS


def test_a_shell_call_keeps_its_programs_in_the_command_s_order(tmp_path: pathlib.Path) -> None:
    shell = fixture_calls(tmp_path).loc[("tree-root", 3, 0)]
    assert shell["name"] == "bash"
    assert list(shell.programs) == ["cd", "pytest"]
    assert shell.arguments_skeleton == '{"command": "cd <path> && pytest <path>"}'


def test_a_native_call_has_no_programs_and_keeps_its_skeleton(tmp_path: pathlib.Path) -> None:
    native = fixture_calls(tmp_path).loc[("tree-root", 2, 0)]
    assert native["name"] == "edit"
    assert native.programs is None
    assert native.arguments_skeleton == '{"new_string": "<str>", "old_string": "<str>", "path": "<path>"}'


def test_every_call_keeps_a_skeleton_and_only_shell_calls_have_programs(tmp_path: pathlib.Path) -> None:
    calls = fixture_calls(tmp_path)
    assert calls.arguments_skeleton.notna().all()
    assert sorted(calls.name[calls.programs.notna()].unique()) == ["bash"]


def test_every_call_joins_exactly_one_request(tmp_path: pathlib.Path) -> None:
    release, site_requests = fixture_release_and_requests(tmp_path)
    calls = tool_calls.tool_calls_frame(release, site_requests)
    joined = calls.merge(site_requests, on=["week", "session_id", "step"], how="inner", validate="many_to_one")
    assert len(joined) == len(calls) == 16


def test_a_call_carries_its_session_s_place(tmp_path: pathlib.Path) -> None:
    calls = fixture_calls(tmp_path)
    spawn = calls.loc[("tree-child", 0, 0)]
    assert (spawn["name"], spawn.category, spawn.is_top_level, spawn.root_session_id) == (
        "task", "Subagent", False, "tree-root")
    benchmark = calls.loc[("swe-bench", 0, 0)]
    assert (benchmark.harness, benchmark.is_top_level, benchmark.week) == ("eval:swe-bench", True, "2026-05-31")


def test_latency_is_the_wait_until_the_next_request_and_missing_after_the_last(tmp_path: pathlib.Path) -> None:
    calls = fixture_calls(tmp_path)
    assert calls.latency_ms.dtype == "Int64"
    assert calls.latency_ms[("tree-root", 3, 0)] == 170_000  # step 4 starts at 1,300 s; step 3 ended at 1,130 s
    assert pandas.isna(calls.latency_ms[("tree-sibling", 1, 0)])


def test_a_call_of_no_request_is_refused(tmp_path: pathlib.Path) -> None:
    release, site_requests = fixture_release_and_requests(tmp_path)
    stray = release.tool_calls.iloc[[0]].assign(step=99)
    with_stray = dataclasses.replace(release, tool_calls=pandas.concat([release.tool_calls, stray]))
    with pytest.raises(ValueError, match="1 tool calls join no request, the first at step 99"):
        tool_calls.tool_calls_frame(with_stray, site_requests)
