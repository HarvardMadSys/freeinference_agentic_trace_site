"""The Prefix-caching figures' queries on the fixture data: hit ratios by gap, by idle gap and by transition, gaps by
cause, and the cache simulation's ratios, which hold the paper's population whatever harnesses are selected."""

import duckdb
import pandas
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]  # the week the fixture did not simulate
SIMULATION_QUERIES = ["figures/simulated_hit_ratio_by_ttl", "figures/retained_over_active",
                      "figures/dead_over_active_by_policy"]
# The fixture's first-week top-level requests of the paper's harnesses, which the simulation replayed: `tree-root` 5,
# `idle-week-1` 3.
REPLAYED_REQUESTS = 8
CDF_POINTS = 201  # every CDF series has this many points, its share running evenly from 0 to 1
MEDIAN_SHARE = 0.5  # the CDF point whose `x` is the median
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


# The TTL-only tallies of the fixture's first week, one row per TTL.
TTL_ONLY_TALLIES = """
SELECT ttl, reusable_token_seconds, dead_token_seconds
FROM simulation
WHERE week = ? AND policy = 'ttl_only'
ORDER BY ttl
"""


def test_retained_over_active_is_a_week_s_ttl_only_tallies_over_its_active_token_seconds(
        connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/retained_over_active")
    tallies = connection.execute(TTL_ONLY_TALLIES, [FIRST_SUNDAY]).df()
    assert rows.ttl.tolist() == tallies.ttl.tolist() == ["1h", "5m"]
    expected_reusable = tallies.reusable_token_seconds / FIRST_WEEK_ACTIVE_TOKEN_SECONDS
    expected_dead = tallies.dead_token_seconds / FIRST_WEEK_ACTIVE_TOKEN_SECONDS
    assert rows.reusable_over_active.tolist() == pytest.approx(expected_reusable.tolist())
    assert rows.dead_over_active.tolist() == pytest.approx(expected_dead.tolist())
    assert rows.reusable_over_active.tolist() == pytest.approx([0.15, 0.05])  # 3,000 and 1,000 of 20,000
    assert rows.dead_over_active.tolist() == pytest.approx([0.1, 0.025])  # 2,000 and 500 of 20,000


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


# The fixture's top-level requests by provider, over both weeks and every harness: A serves `tree-root` 5 and
# `mutation` 3, B `idle-week-1` 3, `idle-week-2` 2 and `idle-benchmark` 1, C `swe-bench` 2.
def test_the_provider_order_counts_every_top_level_request_largest_first(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [SECOND_SUNDAY], ["pi"])  # the order reads no selection
    rows = site_database.run_query(connection, "setup/provider_order")
    assert rows.values.tolist() == [["A", 8], ["B", 6], ["C", 2]]


def test_the_hit_ratio_cdf_after_each_transition(connection: duckdb.DuckDBPyConnection,
                                                 fixture_weeks: list[str]) -> None:
    # The paper's harnesses' nine top-level requests after a first step, those of `AGENTIC_GAPS`: `mutation`'s step 1
    # rewrites its context and reads nothing from cache; the other eight append.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/hit_ratio_cdf_by_transition")
    assert rows.groupby("series").rows.first().to_dict() == {"append": 8, "mutation": 1}
    assert rows[rows.series == "mutation"].x.unique().tolist() == [0.0]
    # Of 1/2, 2/3, 3/4, 3/4, 4/5, 5/6, 5/6 and 6/7, the middle two are 3/4 and 4/5.
    assert cdf_median(rows, "append") == pytest.approx((3 / 4 + 4 / 5) / 2)


def test_a_switch_is_not_drawn_after_a_context_change(connection: duckdb.DuckDBPyConnection,
                                                      fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/hit_ratio_cdf_by_transition")
    assert set(rows.series) <= {"append", "mutation"}


# The gaps of the paper's harnesses' top-level requests, counted by hand from `fixture_release.REQUESTS`, each as
# (seconds, what it waited for, hit ratio): `tree-root` steps 1 to 4, `idle-week-1` steps 1 and 2, `mutation` steps 1
# and 2, `idle-week-2` step 1. The benchmark's `swe-bench` waits 5 s for a tool but is not in the paper's harnesses.
AGENTIC_GAPS = [
    (10, "tool", 1_000 / 2_000), (70, "subagent", 2_000 / 3_000), (10, "tool", 3_000 / 4_000),
    (170, "tool", 4_000 / 5_000), (20, "tool", 900 / 1_200), (5, "tool", 1_200 / 1_400), (10, "tool", 0 / 1_500),
    (170, "tool", 1_500 / 1_800), (90, "user", 1_000 / 1_200),
]


def cdf_median(rows: pandas.DataFrame, series: str) -> float:
    """The `x` of a CDF query's series at share 0.5."""
    return float(rows[(rows.series == series) & (rows.share == MEDIAN_SHARE)].x.iloc[0])


def test_the_hit_ratio_cdf_of_each_gap_bin(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    # Under a minute: the gaps of 10, 10, 20, 5 and 10 s; one to five minutes: 70, 170, 170 and 90 s.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/hit_ratio_cdf_by_gap_bin")
    assert rows.series.unique().tolist() == ["<1m", "1–5m"]
    assert rows.groupby("series", sort=False).rows.first().to_dict() == {"<1m": 5, "1–5m": 4}
    assert len(rows) == 2 * CDF_POINTS
    assert cdf_median(rows, "<1m") == pytest.approx(0.75)  # of 0, 1/2, 3/4, 3/4 and 6/7
    assert cdf_median(rows, "1–5m") == pytest.approx((4 / 5 + 5 / 6) / 2)  # of 2/3, 4/5, 5/6 and 5/6


def test_the_gap_bins_come_shortest_first_and_hold_their_lower_bound(connection: duckdb.DuckDBPyConnection,
                                                                     fixture_weeks: list[str]) -> None:
    # Over every harness `idle-benchmark` adds no gap (its one request is a first step), and `swe-bench`'s 5 s gap
    # has no hit ratio, so the bins hold the paper's harnesses' requests alone; their order is the bins' order.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/hit_ratio_cdf_by_gap_bin")
    assert rows.series.unique().tolist() == ["<1m", "1–5m"]
    assert rows.share.tolist()[:CDF_POINTS] == pytest.approx([step / (CDF_POINTS - 1) for step in range(CDF_POINTS)])


def test_the_gap_cdf_of_each_cause(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/gap_cdf_by_cause")
    assert rows.groupby("series").rows.first().to_dict() == {"subagent": 1, "tool": 7, "user": 1}
    assert cdf_median(rows, "tool") == 10.0  # of 5, 10, 10, 10, 20, 170 and 170 s
    assert cdf_median(rows, "subagent") == 70.0
    assert cdf_median(rows, "user") == 90.0
    assert rows.x.min() == 5.0


def test_the_benchmark_s_tool_gap_counts_without_a_hit_ratio(connection: duckdb.DuckDBPyConnection,
                                                             fixture_weeks: list[str]) -> None:
    # `swe-bench`'s provider reports no cache reads, yet its 5 s gap is a gap.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.BENCHMARK_HARNESSES)
    rows = site_database.run_query(connection, "figures/gap_cdf_by_cause")
    assert rows.groupby("series").rows.first().to_dict() == {"tool": 1}
    assert site_database.run_query(connection, "figures/mean_hit_ratio_by_cause").empty


def test_the_mean_hit_ratio_of_each_cause_in_the_paper_s_order(connection: duckdb.DuckDBPyConnection,
                                                               fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/mean_hit_ratio_by_cause")
    assert rows.waited_for.tolist() == ["tool", "user", "subagent"]
    assert rows.rows.tolist() == [7, 1, 1]
    expected = {}
    for cause in rows.waited_for:
        ratios = [ratio for _seconds, waited_for, ratio in AGENTIC_GAPS if waited_for == cause]
        expected[cause] = sum(ratios) / len(ratios)
    assert rows.set_index("waited_for").mean_hit_ratio.to_dict() == pytest.approx(expected)
