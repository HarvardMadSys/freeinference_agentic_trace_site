"""The index of harnesses: on the fixture, every harness with its top-level sessions, and the benchmark marked."""

import json
import pathlib

import pandas

from site_data import harnesses

# The fixture's top-level sessions by harness, counted by hand from `fixture_release.SESSIONS`: `swe-bench` and
# `idle-benchmark` run eval:swe-bench, `idle-week-1` and `idle-week-2` pi, `tree-root` claude-code (its three
# subagents are not top-level) and `mutation` codex. Most sessions first, ties by name.
FIXTURE_HARNESSES = [
    {"harness": "eval:swe-bench", "sessions": 2, "benchmark": True},
    {"harness": "pi", "sessions": 2, "benchmark": False},
    {"harness": "claude-code", "sessions": 1, "benchmark": False},
    {"harness": "codex", "sessions": 1, "benchmark": False},
]


def test_the_fixture_s_index_counts_top_level_sessions_most_first(data_directory: pathlib.Path) -> None:
    assert json.loads((data_directory / "harnesses.json").read_text()) == FIXTURE_HARNESSES


def test_eval_swe_bench_is_the_one_benchmark_harness(data_directory: pathlib.Path) -> None:
    listed = json.loads((data_directory / "harnesses.json").read_text())
    assert [entry["harness"] for entry in listed if entry["benchmark"]] == ["eval:swe-bench"]


def test_a_harness_of_subagents_only_is_listed_with_no_sessions() -> None:
    sessions = pandas.DataFrame({
        "session_id": ["root", "child"],
        "harness": ["codex", "helper"],
        "parent_session_id": [None, "root"],
    })
    assert harnesses.harnesses_index(sessions) == [
        harnesses.HarnessEntry(harness="codex", sessions=1, benchmark=False),
        harnesses.HarnessEntry(harness="helper", sessions=0, benchmark=False),
    ]
