"""The Sessions figures that rank sessions or split latency, on the fixture data: each figure's rows by hand.

Every request of `fixture_release.REQUESTS` writes 100 output tokens. The paper's harnesses have four top-level
sessions over both weeks, `tree-root`, `idle-week-1`, `mutation` and `idle-week-2`; fewer than ten sessions make one
rank bin, at the 50th percentile.
"""

import duckdb
import pytest

import fixture_release
import site_database

CACHED_PRICE, UNCACHED_PRICE, OUTPUT_PRICE = 1, 10, 50  # per cached input, uncached input and output token
ONE_BIN_PERCENTILE = 50.0  # the middle of the only rank bin

# The cost of each top-level session of the paper's harnesses, (cached, uncached, output), from its requests' input
# and cached tokens: every request reports cache reads.
AGENTIC_SESSION_COSTS = {
    "tree-root": (10_000 * CACHED_PRICE, 5_000 * UNCACHED_PRICE, 500 * OUTPUT_PRICE),
    "idle-week-1": (2_100 * CACHED_PRICE, 1_500 * UNCACHED_PRICE, 300 * OUTPUT_PRICE),
    "mutation": (1_500 * CACHED_PRICE, 3_800 * UNCACHED_PRICE, 300 * OUTPUT_PRICE),
    "idle-week-2": (1_800 * CACHED_PRICE, 400 * UNCACHED_PRICE, 200 * OUTPUT_PRICE),
}
COST_PARTS = ["cached", "uncached", "output"]


def mean_shares(costs: dict[str, tuple[float, ...]]) -> list[float]:
    """The mean over sessions of each part's share of the session's whole."""
    sums = [0.0] * len(next(iter(costs.values())))
    for parts in costs.values():
        for index, part in enumerate(parts):
            sums[index] += part / sum(parts)
    return [total / len(costs) for total in sums]


def pooled_shares(costs: dict[str, tuple[float, ...]]) -> list[float]:
    """Each part's share of the sessions' parts summed."""
    totals = [sum(column) for column in zip(*costs.values())]
    return [total / sum(totals) for total in totals]


def test_the_cost_share_of_four_sessions_is_one_bin_of_their_mean_shares(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/cost_share_by_session")
    assert len(rows) == 1
    row = rows.iloc[0]
    assert (row.percentile, row.rows) == (ONE_BIN_PERCENTILE, len(AGENTIC_SESSION_COSTS))
    assert [row[part] for part in COST_PARTS] == pytest.approx(mean_shares(AGENTIC_SESSION_COSTS))
    pooled = [row[f"pooled_{part}"] for part in COST_PARTS]
    assert pooled == pytest.approx(pooled_shares(AGENTIC_SESSION_COSTS))


def test_the_cost_share_leaves_out_a_session_whose_provider_reports_no_cache_reads(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    # Of the benchmark's sessions, `swe-bench` runs at a provider that reports no cache reads; `idle-benchmark` reads
    # none of its 600 input tokens from cache and writes 100 output tokens.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.BENCHMARK_HARNESSES)
    rows = site_database.run_query(connection, "figures/cost_share_by_session")
    expected = {"idle-benchmark": (0, 600 * UNCACHED_PRICE, 100 * OUTPUT_PRICE)}
    assert rows.rows.tolist() == [1]
    assert [rows.iloc[0][part] for part in COST_PARTS] == pytest.approx(mean_shares(expected))


def test_the_cost_share_of_no_weeks_has_no_rows(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, "figures/cost_share_by_session").empty
