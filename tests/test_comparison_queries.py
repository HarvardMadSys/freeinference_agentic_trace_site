"""The Benchmark-against-production figures' queries: the CDFs of the two scopes and the tool mix along a turn on the
fixture data, counted by hand; each scope CDF's human-driven half against the Sessions CDF of the same quantity, so a
turn's or a session's duration and a request's input are defined once; and the tool mix's group of a call against the
pipeline's on single calls."""

import collections.abc

import duckdb
import pandas
import pyarrow
import pytest

from paper.metrics import trajectories
from release import population

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
    (population.AGENTIC, 1, "Read", 2),
    (population.AGENTIC, 2, "Build/Test", 1),
    (population.AGENTIC, 3, "Other", 2),
    (population.AGENTIC, 5, "Read", 1),
    (population.AGENTIC, 6, "Write/Edit", 1),
    (population.AGENTIC, 7, "Read", 1),
    (population.AGENTIC, 8, "Build/Test", 2),
    (population.SWE_BENCH, 2, "Build/Test", 1),
    (population.SWE_BENCH, 7, "Build/Test", 1),
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
    assert rows.groupby("scope").rows.unique().to_dict() == {population.SWE_BENCH: [BENCHMARK_CALLS],
                                                            population.AGENTIC: [HUMAN_DRIVEN_CALLS]}


def test_the_benchmark_s_tool_mix_is_drawn_whatever_harnesses_are_selected(connection: duckdb.DuckDBPyConnection,
                                                                           fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, [])
    rows = site_database.run_query(connection, TOOL_MIX)
    assert rows.scope.unique().tolist() == [population.SWE_BENCH]
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, TOOL_MIX)
    assert rows.groupby("scope").rows.first().to_dict() == {population.SWE_BENCH: BENCHMARK_CALLS,
                                                           population.AGENTIC: HUMAN_DRIVEN_CALLS}


# Each scope CDF of the fixture over both weeks, counted by hand from `fixture_release.REQUESTS`: per scope its rows and
# median, and the larger median over the smaller. Human-driven: the turns of `tree-root` (310 s), `idle-week-1` (200 s),
# `mutation` (210 s) and `idle-week-2` (two of 10 s); those sessions last 310, 200, 210 and 110 s; their 13 requests'
# inputs run from 1,000 to 5,000 tokens, 1,500 the seventh; each first step's prompt is its 200 user tokens, and
# `idle-week-2`'s second user step adds 42. Benchmark: `swe-bench` (one turn of 25 s, inputs 800 and 1,000) and
# `idle-benchmark` (one of 10 s, input 600), each first prompt 200 tokens.
FIXTURE_SCOPE_CDFS = {
    "figures/turn_duration_by_scope": ({population.AGENTIC: (5, 200.0), population.SWE_BENCH: (2, 17.5)}, 200 / 17.5),
    "figures/session_duration_by_scope": ({population.AGENTIC: (4, 205.0), population.SWE_BENCH: (2, 17.5)}, 205 / 17.5),
    "figures/input_per_request_by_scope": ({population.AGENTIC: (13, 1500.0), population.SWE_BENCH: (3, 800.0)}, 1500 / 800),
    "figures/user_prompt_tokens_by_scope": ({population.AGENTIC: (5, 200.0), population.SWE_BENCH: (2, 200.0)}, 1.0),
}
# Each scope CDF's quantity as a Sessions CDF draws it, for the selected harnesses: (query, series).
SESSIONS_CDF_OF = {
    "figures/turn_duration_by_scope": ("figures/duration_cdf", "turn"),
    "figures/session_duration_by_scope": ("figures/duration_cdf", "session"),
    "figures/input_per_request_by_scope": ("figures/tokens_per_request_cdf", "input"),
}


@pytest.mark.parametrize("name", sorted(FIXTURE_SCOPE_CDFS))
def test_a_scope_cdf_gives_each_scope_s_rows_and_median_and_their_ratio(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str], name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, name)
    scopes, ratio = FIXTURE_SCOPE_CDFS[name]
    for scope, (count, median) in scopes.items():
        points = rows[rows.series == scope]
        assert points.rows.unique().tolist() == [count], scope
        assert points["median"].unique().tolist() == [median], scope
        assert points[points.share == 0.5].x.tolist() == [median], scope
    assert rows.median_ratio.unique().tolist() == [pytest.approx(ratio)]


@pytest.mark.parametrize("name", sorted(FIXTURE_SCOPE_CDFS))
def test_a_scope_cdf_draws_the_benchmark_whatever_harnesses_are_selected(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str], name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, [])
    rows = site_database.run_query(connection, name)
    assert rows.series.unique().tolist() == [population.SWE_BENCH]
    assert rows.median_ratio.isna().all()  # one scope has no ratio


@pytest.mark.parametrize("name", sorted(SESSIONS_CDF_OF))
def test_a_scope_cdf_s_human_driven_half_is_the_sessions_cdf(connection: duckdb.DuckDBPyConnection,
                                                             fixture_weeks: list[str], name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, name)
    sessions_query, series = SESSIONS_CDF_OF[name]
    sessions_rows = site_database.run_query(connection, sessions_query)
    assert rows[rows.series == population.AGENTIC].x.tolist() == sessions_rows[sessions_rows.series == series].x.tolist()


ZERO_MEDIAN_WEEK = "2026-06-07"  # the week of the rows below
# Requests, (harness, input tokens): the human-driven scope's median input is zero, the benchmark's 10.
ZERO_MEDIAN_REQUESTS = [("pi", 0), ("pi", 0), ("pi", 5), (population.BENCHMARK_HARNESS, 10)]


def test_a_ratio_over_a_zero_median_is_missing() -> None:
    harnesses, inputs = zip(*ZERO_MEDIAN_REQUESTS)
    requests = pyarrow.table({
        "week": [ZERO_MEDIAN_WEEK] * len(inputs), "harness": list(harnesses), "is_top_level": [True] * len(inputs),
        "prompt_tokens": list(inputs),
    })
    connection = site_database.database_of_rows(requests, pyarrow.table({"week": [ZERO_MEDIAN_WEEK]}))
    connection.execute(site_database.statement_text("setup/insert_benchmark_harness"), [population.BENCHMARK_HARNESS])
    site_database.select_weeks(connection, [ZERO_MEDIAN_WEEK], ["pi"])
    rows = site_database.run_query(connection, "figures/input_per_request_by_scope")
    connection.close()
    assert rows.groupby("series")["median"].first().to_dict() == {population.AGENTIC: 0, population.SWE_BENCH: 10}
    assert rows.median_ratio.isna().all()


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
    assert rows[["scope", "tenth", "calls", "share"]].values.tolist() == [[population.AGENTIC, ONE_CALL_TENTH, 1, 1.0]]
    assert rows.tool_group.tolist() == [trajectories.group_of_call(category, programs)]
