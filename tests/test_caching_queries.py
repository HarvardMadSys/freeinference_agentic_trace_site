"""The Prefix-caching figures' queries on the fixture data: hit ratios by idle gap and by transition, and the cache
simulation's ratios, which hold the paper's population whatever harnesses are selected."""

import duckdb
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]  # the week the fixture did not simulate
SIMULATION_QUERIES = ["figures/simulated_hit_ratio_by_ttl", "figures/dead_over_active_by_policy"]
# The fixture's first-week top-level requests of the paper's harnesses, which the simulation replayed: `tree-root` 5,
# `idle-week-1` 3.
REPLAYED_REQUESTS = 8
FIRST_WEEK_ACTIVE_TOKEN_SECONDS = 20_000.0  # the fixture's Agentic total, repeated on each of its three tally rows

# A tally of the simulation as the view holds it, one row per policy and TTL of the fixture's first week.
SIMULATION_TALLIES = """
SELECT policy, ttl, hit_tokens, miss_tokens, dead_token_seconds
FROM simulation
WHERE week = ?
ORDER BY policy, ttl
"""


def test_the_simulated_hit_ratio_of_a_week_is_its_hit_over_hit_and_missed_tokens(
        connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/simulated_hit_ratio_by_ttl")
    tallies = connection.execute(SIMULATION_TALLIES, [FIRST_SUNDAY]).df()
    expected = tallies.hit_tokens / (tallies.hit_tokens + tallies.miss_tokens)
    assert rows[["policy", "ttl"]].values.tolist() == tallies[["policy", "ttl"]].values.tolist()
    assert rows.hit_ratio.tolist() == pytest.approx(expected.tolist())
    assert rows.hit_ratio.tolist() == pytest.approx([0.6, 0.8, 0.6])  # 6,000 of 10,000; 8,000 of 10,000; 6,000 of 10,000


def test_dead_over_active_sums_a_week_s_active_token_seconds_once(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/dead_over_active_by_policy")
    tallies = connection.execute(SIMULATION_TALLIES, [FIRST_SUNDAY]).df()
    expected = tallies.dead_token_seconds / FIRST_WEEK_ACTIVE_TOKEN_SECONDS
    assert rows.dead_over_active.tolist() == pytest.approx(expected.tolist())
    assert rows.dead_over_active.tolist() == pytest.approx([0.0, 0.1, 0.025])


@pytest.mark.parametrize("name", SIMULATION_QUERIES)
@pytest.mark.parametrize("harnesses", [
    fixture_release.PAPER_HARNESSES, fixture_release.BENCHMARK_HARNESSES, fixture_release.EVERY_HARNESS, ["pi"], []])
def test_a_simulation_figure_holds_the_paper_s_rows_of_the_simulated_weeks_whatever_harnesses_are_selected(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str], name: str, harnesses: list[str]) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)
    paper_population = site_database.run_query(connection, name)
    site_database.select_weeks(connection, fixture_weeks, harnesses)
    rows = site_database.run_query(connection, name)
    assert rows.equals(paper_population)
    assert rows.rows.unique().tolist() == [REPLAYED_REQUESTS]


@pytest.mark.parametrize("name", SIMULATION_QUERIES)
def test_a_week_the_simulation_did_not_cover_has_no_simulated_rows(connection: duckdb.DuckDBPyConnection,
                                                                    name: str) -> None:
    site_database.select_weeks(connection, [SECOND_SUNDAY], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, name).empty


def test_the_idle_gap_bins_hold_each_provider_s_gaps_up_to_an_hour(connection: duckdb.DuckDBPyConnection,
                                                                    fixture_weeks: list[str]) -> None:
    # Provider B serves `idle-week-1` and `idle-week-2` of one user: gaps of 20 s (bin 3, hit ratio 900 / 1,200),
    # 5 s (counted in bin 0, 1,200 / 1,400) and 90 s (bin 9, 1,000 / 1,200). The 4,800 s gap of `idle-week-2`'s first
    # request, across the week boundary, is over an hour and falls in no bin.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/hit_ratio_by_idle_gap")
    provider_b = rows[rows.provider == "B"]
    assert provider_b.idle_gap_bin.tolist() == [0, 3, 9]
    assert provider_b.rows.tolist() == [1, 1, 1]
    assert provider_b.median_hit_ratio.tolist() == pytest.approx([1_200 / 1_400, 900 / 1_200, 1_000 / 1_200])
    assert rows.idle_gap_bin.between(0, 25).all()


def test_the_mean_hit_ratio_after_each_transition(connection: duckdb.DuckDBPyConnection,
                                                  fixture_weeks: list[str]) -> None:
    # The paper's harnesses' nine top-level requests after a first step: `mutation`'s step 1 reads nothing from cache.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/hit_ratio_by_transition").set_index("transition")
    assert rows.rows.to_dict() == {"append": 8, "mutation": 1}
    assert rows.mean_hit_ratio["mutation"] == 0.0
    assert 0.0 < rows.mean_hit_ratio["append"] <= 1.0
