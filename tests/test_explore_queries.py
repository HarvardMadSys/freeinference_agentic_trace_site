"""The Explore page's queries give the fixture's numbers, counted by hand from `fixture_release`.

The fixture's top-level sessions are `tree-root` (claude-code), `swe-bench` (eval:swe-bench) and
`idle-week-1` (pi) in the first week, and `mutation` (codex), `idle-week-2` (pi) and `idle-benchmark`
(eval:swe-bench) in the second. `swe-bench` is at the one provider that reports no cache reads; the
two eval:swe-bench sessions are the SWE-Bench scope, the rest Agentic.
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


def select(connection: duckdb.DuckDBPyConnection, weeks: list[str], scope: str) -> None:
    """Fill the selection tables with `weeks` and the scopes `scope` covers."""
    site_database.select_weeks(connection, weeks, site_database.SCOPES_OF[scope])


def records(connection: duckdb.DuckDBPyConnection, name: str) -> list[dict]:
    """The rows of the query `name` as one dict per row."""
    return site_database.run_query(connection, name).to_dict("records")


def test_the_harness_order_counts_top_level_sessions_of_every_week_and_scope_largest_first(
        connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], "Agentic")  # the order ignores the selection
    assert records(connection, "setup/harness_order") == [
        {"harness": "eval:swe-bench", "sessions": 2},
        {"harness": "pi", "sessions": 2},
        {"harness": "claude-code", "sessions": 1},
        {"harness": "codex", "sessions": 1},
    ]


def test_sessions_per_week_cover_every_week_in_the_selected_scope(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], "Agentic")  # the trend shows every week, whatever weeks are selected
    assert records(connection, "explore/sessions_per_week_by_harness") == [
        {"week": FIRST_SUNDAY, "harness": "claude-code", "sessions": 1},
        {"week": FIRST_SUNDAY, "harness": "pi", "sessions": 1},
        {"week": SECOND_SUNDAY, "harness": "codex", "sessions": 1},
        {"week": SECOND_SUNDAY, "harness": "pi", "sessions": 1},
    ]


# First week: `tree-root` reads 0+1,000+2,000+3,000+4,000 cached of 15,000 input and `idle-week-1` 0+900+1,200
# of 3,600; `swe-bench`'s 1,800 are unreported. Second week: `mutation` reads 1,500 of 5,300, `idle-week-2`
# 1,800 of 2,200 and `idle-benchmark` 0 of 600. Uncached is input minus cached on the reporting requests.
@pytest.mark.parametrize(("scope", "expected"), [
    ("All", [
        {"week": FIRST_SUNDAY, "requests": 10, "cached_tokens": 12_100, "uncached_tokens": 6_500,
         "unreported_tokens": 1_800},
        {"week": SECOND_SUNDAY, "requests": 6, "cached_tokens": 3_300, "uncached_tokens": 4_800,
         "unreported_tokens": 0},
    ]),
    ("SWE-Bench", [
        {"week": FIRST_SUNDAY, "requests": 2, "cached_tokens": 0, "uncached_tokens": 0, "unreported_tokens": 1_800},
        {"week": SECOND_SUNDAY, "requests": 1, "cached_tokens": 0, "uncached_tokens": 600, "unreported_tokens": 0},
    ]),
])
def test_input_tokens_per_week_split_into_cached_uncached_and_unreported(connection: duckdb.DuckDBPyConnection,
                                                                        scope: str, expected: list[dict]) -> None:
    select(connection, [SECOND_SUNDAY], scope)
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


def test_the_headline_counts_equal_the_release_s_top_level_totals_under_scope_all(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, "All")
    headline = records(connection, "explore/headline_numbers")[0]
    assert {column: headline[column] for column in ("sessions", "accounts", "requests", "tool_calls")} == {
        "sessions": 6, "accounts": 4, "requests": 16, "tool_calls": 12}
    assert {column: headline[column] for column in ("sessions", "accounts", "requests", "tool_calls")} == \
        release_top_level_totals()


# `tree-root` spawns three subagents, at depths 1 and 2; the input, cached and reported input are the sums of the
# top-level requests' prompt and cache-read tokens, every request answering with 100 completion tokens.
def test_the_headline_token_totals_and_subagents(connection: duckdb.DuckDBPyConnection,
                                                  fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, "All")
    headline = records(connection, "explore/headline_numbers")[0]
    assert headline["input_tokens"] == 28_500
    assert headline["output_tokens"] == 1_600
    assert headline["subagents"] == 3
    assert headline["reported_input_tokens"] == 28_500 - 1_800  # `swe-bench`'s provider reports no cache reads
    assert headline["cached_tokens"] == 12_100 + 3_300


def test_the_headline_of_a_selection_with_no_sessions_is_zero(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, ["2000-01-02"], "All")
    headline = records(connection, "explore/headline_numbers")[0]
    assert set(headline.values()) == {0}


def test_the_model_mix_counts_top_level_requests_per_model_largest_first(
        connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], "All")
    assert records(connection, "explore/model_mix") == [
        {"model": "model-x", "requests": 8},  # `tree-root` 5 and `idle-week-1` 3
        {"model": "model-y", "requests": 2},  # `swe-bench`; `tree-sibling`'s model-y request is a subagent's
    ]


def test_the_model_order_counts_every_week_and_scope(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [SECOND_SUNDAY], "Agentic")  # the order ignores the selection
    assert records(connection, "setup/model_order") == [
        {"model": "model-x", "requests": 14},
        {"model": "model-y", "requests": 2},
    ]


# Each distribution card: the data file it reads, of requests or of sessions, and the column it takes.
DISTRIBUTION_CARDS = {
    "input_tokens": ("requests.parquet", "prompt_tokens"),
    "uncached_tokens": ("requests.parquet", "uncached_tokens"),
    "output_tokens": ("requests.parquet", "completion_tokens"),
    "cached_fraction": ("requests.parquet", "hit_ratio"),
    "requests_per_session": ("sessions.parquet", "requests"),
    "turns_per_session": ("sessions.parquet", "user_steps"),
    "subagents_per_session": ("sessions.parquet", "subagents"),
    "session_duration": ("sessions.parquet", "duration_s"),
}


def top_level_values(data_directory: pathlib.Path, card: str, weeks: list[str], scope: str) -> list[float]:
    """The card's values over the top-level rows of `weeks` and `scope`, read with pandas; missing values left out."""
    file_name, column = DISTRIBUTION_CARDS[card]
    rows = pandas.read_parquet(data_directory / file_name)
    if file_name == "requests.parquet":
        top_level = rows.is_top_level
    else:
        top_level = rows.parent_session_id.isna()
    chosen = rows[top_level & rows.week.isin(weeks) & rows.scope.isin(site_database.SCOPES_OF[scope])]
    return chosen[column].dropna().tolist()


@pytest.mark.parametrize("scope", ["All", "Agentic"])
@pytest.mark.parametrize("card", sorted(DISTRIBUTION_CARDS))
def test_a_card_s_median_count_and_maximum_are_those_of_its_values(connection: duckdb.DuckDBPyConnection,
                                                                    data_directory: pathlib.Path,
                                                                    fixture_weeks: list[str], card: str,
                                                                    scope: str) -> None:
    select(connection, fixture_weeks, scope)
    stats = records(connection, f"explore/{card}_stats")[0]
    values = top_level_values(data_directory, card, fixture_weeks, scope)
    assert stats["p50"] == pytest.approx(statistics.median(values))
    assert stats["count"] == len(values)
    assert stats["max"] == pytest.approx(max(values))
    assert stats["p50"] <= stats["p75"] <= stats["p90"] <= stats["p95"] <= stats["max"]


# The first week's top-level input tokens: `tree-root` 1,000 to 5,000, `swe-bench` 800 and 1,000, `idle-week-1`
# 1,000, 1,200 and 1,400; sorted, the middle two are 1,200 and 1,400.
def test_one_week_s_input_tokens_median_is_counted_by_hand(connection: duckdb.DuckDBPyConnection) -> None:
    select(connection, [FIRST_SUNDAY], "All")
    assert records(connection, "explore/input_tokens_stats")[0]["p50"] == 1_300


@pytest.mark.parametrize("card", sorted(DISTRIBUTION_CARDS))
def test_a_card_s_bins_hold_every_value_once_smallest_first(connection: duckdb.DuckDBPyConnection,
                                                           fixture_weeks: list[str], card: str) -> None:
    select(connection, fixture_weeks, "All")
    bins = records(connection, f"explore/{card}_bins")
    stats = records(connection, f"explore/{card}_stats")[0]
    assert sum(row["rows"] for row in bins) == stats["count"]
    starts = [row["bin_start"] for row in bins]
    assert starts == sorted(starts)
    for row in bins:
        assert row["bin_start"] < row["bin_end"]


# `tree-root` has 5 requests (in [4, 8)), `idle-week-1` and `mutation` 3 (in [2, 4)), `swe-bench` and
# `idle-week-2` 2 (in [2, 4)), `idle-benchmark` 1 (in [1, 2)).
def test_the_log_bins_are_powers_of_two(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, "All")
    assert records(connection, "explore/requests_per_session_bins") == [
        {"bin_start": 1, "bin_end": 2, "rows": 1},
        {"bin_start": 2, "bin_end": 4, "rows": 4},
        {"bin_start": 4, "bin_end": 8, "rows": 1},
    ]


# Five top-level sessions spawned nothing and `tree-root` spawned three.
def test_a_value_of_0_falls_in_the_first_bin(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, "All")
    assert records(connection, "explore/subagents_per_session_bins") == [
        {"bin_start": 0, "bin_end": 1, "rows": 5},
        {"bin_start": 2, "bin_end": 4, "rows": 1},
    ]


def test_the_cached_fraction_has_twenty_bins_of_a_twentieth_with_1_in_the_last(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    select(connection, fixture_weeks, "All")
    bins = records(connection, "explore/cached_fraction_bins")
    for row in bins:
        assert row["bin_end"] - row["bin_start"] == pytest.approx(0.05)
    assert bins[0]["bin_start"] == 0  # the first requests of most sessions read nothing from the cache
    assert bins[-1]["bin_end"] <= 1
