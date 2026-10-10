"""The Explore page's queries give the fixture's numbers, counted by hand from `fixture_release`.

The fixture's top-level sessions are `tree-root` (claude-code), `swe-bench` (eval:swe-bench) and
`idle-week-1` (pi) in the first week, and `mutation` (codex), `idle-week-2` (pi) and `idle-benchmark`
(eval:swe-bench) in the second. `swe-bench` is at the one provider that reports no cache reads; the
two eval:swe-bench sessions are the SWE-Bench scope, the rest Agentic.
"""

import duckdb
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
