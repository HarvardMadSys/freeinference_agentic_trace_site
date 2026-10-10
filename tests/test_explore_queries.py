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
