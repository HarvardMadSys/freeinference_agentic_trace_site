"""The Explore page's queries give the fixture's numbers, counted by hand from `fixture_release`.

The fixture's top-level sessions are `tree-root` (claude-code), `swe-bench` (eval:swe-bench) and
`idle-week-1` (pi) in the first week, and `mutation` (codex), `idle-week-2` (pi) and `idle-benchmark`
(eval:swe-bench) in the second. `swe-bench` is at the one provider that reports no cache reads; the
two eval:swe-bench sessions are the benchmark's, the rest the paper's population.
"""

import pathlib
import statistics

import duckdb
import pandas
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]


def select(connection: duckdb.DuckDBPyConnection, weeks: list[str], harnesses: list[str]) -> None:
    """Fill the selection tables with `weeks` and `harnesses`."""
    site_database.select_weeks(connection, weeks, harnesses)


def records(connection: duckdb.DuckDBPyConnection, name: str) -> list[dict]:
    """The rows of the query `name` as one dict per row."""
    return site_database.run_query(connection, name).to_dict("records")


def test_the_harness_order_counts_top_level_sessions_of_every_week_and_harness_largest_first(
        connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)  # the order ignores the selection
    assert records(connection, "setup/harness_order") == [
        {"harness": "eval:swe-bench", "sessions": 2},
        {"harness": "pi", "sessions": 2},
        {"harness": "claude-code", "sessions": 1},
        {"harness": "codex", "sessions": 1},
    ]


def test_sessions_per_week_cover_every_week_of_the_selected_harnesses(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)  # the trend shows every week, whatever weeks are selected
    assert records(connection, "explore/sessions_per_week_by_harness") == [
        {"week": FIRST_SUNDAY, "harness": "claude-code", "sessions": 1},
        {"week": FIRST_SUNDAY, "harness": "pi", "sessions": 1},
        {"week": SECOND_SUNDAY, "harness": "codex", "sessions": 1},
        {"week": SECOND_SUNDAY, "harness": "pi", "sessions": 1},
    ]


# Every top-level request is model-x's but `swe-bench`'s two, the benchmark's, which are model-y's.
def test_requests_per_week_by_model_cover_every_week_and_sum_to_each_week_s_requests(
        connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [SECOND_SUNDAY], fixture_release.EVERY_HARNESS)  # the trend shows every week, whatever weeks are selected
    segments = records(connection, "explore/requests_per_week_by_model")
    assert segments == [
        {"week": FIRST_SUNDAY, "model": "model-x", "requests": 8},
        {"week": FIRST_SUNDAY, "model": "model-y", "requests": 2},
        {"week": SECOND_SUNDAY, "model": "model-x", "requests": 6},
    ]
    for week in records(connection, "explore/input_tokens_per_week"):
        week_segments = [segment["requests"] for segment in segments if segment["week"] == week["week"]]
        assert sum(week_segments) == week["requests"]


# Of the benchmark's sessions, `swe-bench` sends two model-y requests in the first week and `idle-benchmark` one
# model-x request in the second; every other harness's request is left out.
def test_requests_per_week_by_model_count_only_the_selected_harnesses(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], fixture_release.BENCHMARK_HARNESSES)
    assert records(connection, "explore/requests_per_week_by_model") == [
        {"week": FIRST_SUNDAY, "model": "model-y", "requests": 2},
        {"week": SECOND_SUNDAY, "model": "model-x", "requests": 1},
    ]


# First week: `tree-root` reads 0+1,000+2,000+3,000+4,000 cached of 15,000 input and `idle-week-1` 0+900+1,200
# of 3,600; `swe-bench`'s 1,800 are unreported. Second week: `mutation` reads 1,500 of 5,300, `idle-week-2`
# 1,800 of 2,200 and `idle-benchmark` 0 of 600. Uncached is input minus cached on the reporting requests.
@pytest.mark.parametrize(("harnesses", "expected"), [
    (fixture_release.EVERY_HARNESS, [
        {"week": FIRST_SUNDAY, "requests": 10, "cached_tokens": 12_100, "uncached_tokens": 6_500,
         "unreported_tokens": 1_800},
        {"week": SECOND_SUNDAY, "requests": 6, "cached_tokens": 3_300, "uncached_tokens": 4_800,
         "unreported_tokens": 0},
    ]),
    (fixture_release.BENCHMARK_HARNESSES, [
        {"week": FIRST_SUNDAY, "requests": 2, "cached_tokens": 0, "uncached_tokens": 0, "unreported_tokens": 1_800},
        {"week": SECOND_SUNDAY, "requests": 1, "cached_tokens": 0, "uncached_tokens": 600, "unreported_tokens": 0},
    ]),
])
def test_input_tokens_per_week_split_into_cached_uncached_and_unreported(connection: duckdb.DuckDBPyConnection,
                                                                        harnesses: list[str],
                                                                        expected: list[dict]) -> None:
    select(connection, [SECOND_SUNDAY], harnesses)
    assert records(connection, "explore/input_tokens_per_week") == expected


def release_top_level_totals() -> dict:
    """Sessions, accounts, requests and tool calls of the fixture release's top-level sessions, counted from its rows."""
    top_level = [session for session in fixture_release.SESSIONS if session.parent_session_id is None]
    top_level_ids = {session.session_id for session in top_level}
    requests = [request for request in fixture_release.REQUESTS if request.session_id in top_level_ids]
    tool_calls = 0
    for request in requests:
        tool_calls += len(request.calls)
    return {
        "sessions": len(top_level),
        "accounts": len({session.user_id for session in top_level}),
        "requests": len(requests),
        "tool_calls": tool_calls,
    }


def test_the_headline_counts_equal_the_release_s_top_level_totals_with_every_harness(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    headline = records(connection, "explore/headline_numbers")[0]
    assert {column: headline[column] for column in ("sessions", "accounts", "requests", "tool_calls")} == {
        "sessions": 6, "accounts": 4, "requests": 16, "tool_calls": 12}
    assert {column: headline[column] for column in ("sessions", "accounts", "requests", "tool_calls")} == \
        release_top_level_totals()


# `tree-root` spawns three subagents, at depths 1 and 2; the input, cached and reported input are the sums of the
# top-level requests' prompt and cache-read tokens, every request answering with 100 completion tokens.
def test_the_headline_token_totals_and_subagents(connection: duckdb.DuckDBPyConnection,
                                                  fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    headline = records(connection, "explore/headline_numbers")[0]
    assert headline["input_tokens"] == 28_500
    assert headline["output_tokens"] == 1_600
    assert headline["subagents"] == 3
    assert headline["reported_input_tokens"] == 28_500 - 1_800  # `swe-bench`'s provider reports no cache reads
    assert headline["cached_tokens"] == 12_100 + 3_300


def test_the_headline_of_a_selection_with_no_sessions_is_zero(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, ["2000-01-02"], fixture_release.EVERY_HARNESS)
    headline = records(connection, "explore/headline_numbers")[0]
    assert set(headline.values()) == {0}


# With every harness: the six top-level sessions with their 16 requests, 28,500 input tokens and 12 tool calls, as the
# headline counts them, and four harnesses, `eval:swe-bench` the benchmark's.
def test_the_trace_totals_count_every_harness_and_the_benchmark_s_apart(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    assert records(connection, "explore/trace_totals") == [{
        "sessions": 6, "requests": 16, "input_tokens": 28_500, "tool_calls": 12, "harnesses": 4,
        "benchmark_harnesses": 1}]


def test_the_trace_totals_of_the_paper_s_harnesses_count_no_benchmark_harness(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    totals = records(connection, "explore/trace_totals")[0]
    assert (totals["sessions"], totals["harnesses"], totals["benchmark_harnesses"]) == (4, 3, 0)


def test_the_model_mix_counts_top_level_requests_per_model_largest_first(
        connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], fixture_release.EVERY_HARNESS)
    assert records(connection, "explore/model_mix") == [
        {"model": "model-x", "requests": 8},  # `tree-root` 5 and `idle-week-1` 3
        {"model": "model-y", "requests": 2},  # `swe-bench`; `tree-sibling`'s model-y request is a subagent's
    ]


def test_the_model_order_counts_every_week_and_harness(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [SECOND_SUNDAY], fixture_release.PAPER_HARNESSES)  # the order ignores the selection
    assert records(connection, "setup/model_order") == [
        {"model": "model-x", "requests": 14},
        {"model": "model-y", "requests": 2},
    ]


# Each pair of histogram queries, by their prefix: the folder of the rows they read, requests or sessions, and the column
# they take.
HISTOGRAM_QUERIES = {
    "cached_fraction": ("requests", "hit_ratio"),
    "subagents_per_session": ("sessions", "subagents"),
}


def top_level_values(data_directory: pathlib.Path, histogram: str, weeks: list[str], harnesses: list[str]) -> list[float]:
    """The histogram's values over the top-level rows of `weeks` and `harnesses`, read with pandas from each week's file;
    missing values left out."""
    kind_folder, column = HISTOGRAM_QUERIES[histogram]
    values = []
    for week in weeks:
        rows = pandas.read_parquet(data_directory / kind_folder / f"week={week}" / "rows.parquet")
        if kind_folder == "requests":
            top_level = rows.is_top_level
        else:
            top_level = rows.parent_session_id.isna()
        values.extend(rows[top_level & rows.harness.isin(harnesses)][column].dropna().tolist())
    return values


@pytest.mark.parametrize("harnesses", [fixture_release.EVERY_HARNESS, fixture_release.PAPER_HARNESSES])
@pytest.mark.parametrize("histogram", sorted(HISTOGRAM_QUERIES))
def test_a_histogram_s_median_count_and_maximum_are_those_of_its_values(connection: duckdb.DuckDBPyConnection,
                                                                    data_directory: pathlib.Path,
                                                                    fixture_weeks: list[str], histogram: str,
                                                                    harnesses: list[str]) -> None:
    select(connection, fixture_weeks, harnesses)
    stats = records(connection, f"explore/{histogram}_stats")[0]
    values = top_level_values(data_directory, histogram, fixture_weeks, harnesses)
    assert stats["p50"] == pytest.approx(statistics.median(values))
    assert stats["count"] == len(values)
    assert stats["max"] == pytest.approx(max(values))
    assert stats["p50"] <= stats["p75"] <= stats["p90"] <= stats["p95"] <= stats["max"]


@pytest.mark.parametrize("histogram", sorted(HISTOGRAM_QUERIES))
def test_a_histogram_s_bins_hold_every_value_once_smallest_first(connection: duckdb.DuckDBPyConnection,
                                                           fixture_weeks: list[str], histogram: str) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    bins = records(connection, f"explore/{histogram}_bins")
    stats = records(connection, f"explore/{histogram}_stats")[0]
    assert sum(row["rows"] for row in bins) == stats["count"]
    starts = [row["bin_start"] for row in bins]
    assert starts == sorted(starts)
    for row in bins:
        assert row["bin_start"] < row["bin_end"]


# Five top-level sessions spawned nothing and `tree-root` spawned three, which falls in the power-of-two bin [2, 4).
def test_a_value_of_0_falls_in_the_first_bin_and_the_others_in_powers_of_two(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    assert records(connection, "explore/subagents_per_session_bins") == [
        {"bin_start": 0, "bin_end": 1, "rows": 5},
        {"bin_start": 2, "bin_end": 4, "rows": 1},
    ]


def test_the_cached_fraction_has_twenty_bins_of_a_twentieth_with_1_in_the_last(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    bins = records(connection, "explore/cached_fraction_bins")
    for row in bins:
        assert row["bin_end"] - row["bin_start"] == pytest.approx(0.05)
    assert bins[0]["bin_start"] == 0  # the first requests of most sessions read nothing from the cache
    assert bins[-1]["bin_end"] <= 1


# Input tokens of the top-level sessions: `tree-root` 15,000, `idle-week-1` 3,600, `swe-bench` 1,800 in the
# first week; `mutation` 5,300, `idle-week-2` 2,200, `idle-benchmark` 600 in the second.
def test_the_sessions_table_lists_the_selection_s_top_level_sessions_most_input_first(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = records(connection, "explore/sessions_of_selection")
    assert [(row["session_id"], row["input_tokens"]) for row in rows] == [
        ("tree-root", 15_000), ("mutation", 5_300), ("idle-week-1", 3_600), ("idle-week-2", 2_200),
        ("swe-bench", 1_800), ("idle-benchmark", 600),
    ]
    tree_root = rows[0]
    assert (tree_root["week"], tree_root["requests"], tree_root["turns"]) == (FIRST_SUNDAY, 5, 1)


def test_the_sessions_table_marks_the_benchmark_s_sessions(connection: duckdb.DuckDBPyConnection,
                                                          fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = records(connection, "explore/sessions_of_selection")
    assert {row["session_id"]: row["benchmark"] for row in rows} == {
        "tree-root": False, "mutation": False, "idle-week-1": False, "idle-week-2": False,
        "swe-bench": True, "idle-benchmark": True,
    }


def test_the_sessions_table_keeps_to_the_selected_weeks_and_harnesses(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [SECOND_SUNDAY], fixture_release.PAPER_HARNESSES)
    rows = records(connection, "explore/sessions_of_selection")
    assert [row["session_id"] for row in rows] == ["mutation", "idle-week-2"]


def test_the_sessions_table_s_first_page_is_the_full_list_s_newest_sessions_with_its_count(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    listed = records(connection, "explore/sessions_of_selection")
    first_page = records(connection, "explore/sessions_first_page")
    # The table sorts the full list by start, newest first, keeping the list's order among equal starts.
    newest_first = sorted(listed, key=lambda row: -row["first_start_ms"])
    assert [row["session_id"] for row in first_page] == [row["session_id"] for row in newest_first[:20]]
    assert {row["total_sessions"] for row in first_page} == {len(listed)}
    for row in first_page:
        listed_row = next(candidate for candidate in listed if candidate["session_id"] == row["session_id"])
        assert {key: value for key, value in row.items() if key != "total_sessions"} == listed_row
