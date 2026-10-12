"""The Benchmark-against-production figures' queries: the tool mix along a turn on the fixture data, counted by hand,
and its group of a call against the pipeline's on single calls."""

import collections.abc

import duckdb
import pandas
import pyarrow
import pytest

from paper.metrics import trajectories

import fixture_release
import site_database

TOOL_MIX = "figures/tool_mix_by_turn_position"
ONE_CALL_WEEK = "2026-06-07"  # the week of the single-call database's one request
ONE_CALL_HARNESS = "pi"  # a harness of the paper's, so its call is human-driven
ONE_CALL_TENTH = 5  # a turn's only calling request (k = 0, n = 1) falls in tenth ⌊10 · 0.5 / 1⌋

# The tool mix of the fixture over both weeks, counted by hand from `fixture_release.REQUESTS`, as (scope, tenth,
# group, calls). A turn's calling requests k = 0 … n − 1 fall in tenth ⌊10 (k + 0.5) / n⌋. Human-driven: `tree-root`'s
# one turn has four (n = 4: tenths 1, 3, 6, 8) calling Read, Subagent twice (Other), Edit and bash (*Build/Test);
# `idle-week-1`'s three (tenths 1, 5, 8) call Read, Read and bash; `mutation`'s two (tenths 2, 7) bash and Read;
# `idle-week-2` calls nothing. Benchmark: `swe-bench`'s two (tenths 2, 7) each call bash.
FIXTURE_TOOL_MIX = [
    ("human-driven", 1, "Read", 2),
    ("human-driven", 2, "Build/Test", 1),
    ("human-driven", 3, "Other", 2),
    ("human-driven", 5, "Read", 1),
    ("human-driven", 6, "Write/Edit", 1),
    ("human-driven", 7, "Read", 1),
    ("human-driven", 8, "Build/Test", 2),
    ("benchmark", 2, "Build/Test", 1),
    ("benchmark", 7, "Build/Test", 1),
]
HUMAN_DRIVEN_CALLS = 10
BENCHMARK_CALLS = 2


def tool_mix(rows: pandas.DataFrame) -> list[tuple]:
    """The rows' (scope, tenth, group, calls), sorted."""
    return sorted((row.scope, row.tenth, row.tool_group, row.calls) for row in rows.itertuples())


def test_the_tool_mix_bins_each_turn_s_calling_requests_into_tenths(connection: duckdb.DuckDBPyConnection,
                                                                     fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, TOOL_MIX)
    assert tool_mix(rows) == sorted(FIXTURE_TOOL_MIX)
    assert rows.share.tolist() == [1.0] * len(FIXTURE_TOOL_MIX)  # every tenth of the fixture holds one group
    assert rows.groupby("scope").rows.unique().to_dict() == {"benchmark": [BENCHMARK_CALLS],
                                                            "human-driven": [HUMAN_DRIVEN_CALLS]}


def test_the_benchmark_s_tool_mix_is_drawn_whatever_harnesses_are_selected(connection: duckdb.DuckDBPyConnection,
                                                                           fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, [])
    rows = site_database.run_query(connection, TOOL_MIX)
    assert rows.scope.unique().tolist() == ["benchmark"]
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, TOOL_MIX)
    assert rows.groupby("scope").rows.first().to_dict() == {"benchmark": BENCHMARK_CALLS,
                                                           "human-driven": HUMAN_DRIVEN_CALLS}


def one_call_database(category: str, programs: list[str] | None) -> duckdb.DuckDBPyConnection:
    """A database holding one top-level request of a paper harness, the only one of its turn, which made one call of
    `category` that ran `programs`; its week and harness are selected."""
    requests = pyarrow.table({
        "week": [ONE_CALL_WEEK], "session_id": ["one-call"], "step": [0], "turn": [1], "n_tool_calls": [1],
        "is_top_level": [True], "harness": [ONE_CALL_HARNESS],
    })
    tool_calls = pyarrow.table({
        "week": [ONE_CALL_WEEK], "session_id": ["one-call"], "step": [0], "call_index": [0], "category": [category],
        "programs": pyarrow.array([programs], type=pyarrow.list_(pyarrow.string())), "is_top_level": [True],
    })
    connection = site_database.database_of_rows(requests, tool_calls)
    site_database.select_weeks(connection, [ONE_CALL_WEEK], [ONE_CALL_HARNESS])
    return connection


# Calls whose group each part of the rule decides: a `*File Ops` call by the first word of its programs, any writing
# one first, case and leading spaces aside; every other category by the pipeline's map, Other when it is not in it.
SINGLE_CALLS = [
    ("*File Ops", ["mkdir -p out", "ls"]),
    ("*File Ops", ["cat notes.txt", "rm -rf build"]),
    ("*File Ops", ["  LS -la"]),
    ("*File Ops", ["Get-ChildItem ."]),
    ("*File Ops", ["echo done"]),
    ("*File Ops", [""]),
    ("*File Ops", []),
    ("*File Ops", None),
    ("*Network", ["curl <url>"]),
    ("Edit", None),
    ("MCP", None),
]


@pytest.fixture(params=SINGLE_CALLS, ids=str)
def single_call(request: pytest.FixtureRequest) -> collections.abc.Iterator[tuple]:
    """A single call's category and programs, with a database holding it alone."""
    category, programs = request.param
    connection = one_call_database(category, programs)
    yield category, programs, connection
    connection.close()


def test_a_call_s_group_is_the_pipeline_s(single_call: tuple) -> None:
    category, programs, connection = single_call
    rows = site_database.run_query(connection, TOOL_MIX)
    assert rows[["scope", "tenth", "calls", "share"]].values.tolist() == [["human-driven", ONE_CALL_TENTH, 1, 1.0]]
    assert rows.tool_group.tolist() == [trajectories.group_of_call(category, programs)]
