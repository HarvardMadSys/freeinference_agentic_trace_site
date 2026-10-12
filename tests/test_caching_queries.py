"""The Prefix-caching figures' queries on the fixture data: hit ratios by gap, by idle gap and by transition, and gaps
by cause."""

import collections.abc

import duckdb
import pandas
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]  # the week the fixture did not simulate
CDF_POINTS = 201  # every CDF series has this many points, its share running evenly from 0 to 1
MEDIAN_SHARE = 0.5  # the CDF point whose `x` is the median


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


# Two top-level requests of one week and harness, each after a wait for a tool: one starts the moment the request
# before it ended, a gap of 0 s, which counts; the other starts 2 s before the request before it ended, an overlap,
# which is not a gap and is dropped. The fixture release has neither, so the case is a table of its own.
WAIT_CASES = pandas.DataFrame({
    "week": [FIRST_SUNDAY, FIRST_SUNDAY],
    "harness": ["pi", "pi"],
    "is_top_level": [True, True],
    "waited_for": ["tool", "tool"],
    "wait_s": [0.0, -2.0],
    "hit_ratio": [0.5, 0.9],
})


@pytest.fixture
def wait_cases() -> collections.abc.Iterator[duckdb.DuckDBPyConnection]:
    """A database whose `requests` are `WAIT_CASES`, with their week and harness selected."""
    database = duckdb.connect()
    for name in site_database.SELECTION_TABLE_STATEMENTS:
        database.execute(site_database.statement_text(name))
    database.register("requests", WAIT_CASES)
    site_database.select_weeks(database, [FIRST_SUNDAY], ["pi"])
    yield database
    database.close()


def test_a_gap_of_0_s_counts_and_an_overlap_does_not(wait_cases: duckdb.DuckDBPyConnection) -> None:
    gaps = site_database.run_query(wait_cases, "figures/gap_cdf_by_cause")
    assert gaps.rows.unique().tolist() == [1]
    assert gaps.x.unique().tolist() == [0.0]
    means = site_database.run_query(wait_cases, "figures/mean_hit_ratio_by_cause")
    assert means.values.tolist() == [["tool", 1, 0.5]]
    bins = site_database.run_query(wait_cases, "figures/hit_ratio_cdf_by_gap_bin")
    assert bins.series.unique().tolist() == ["<1m"]
    assert bins.rows.unique().tolist() == [1]
    assert bins.x.unique().tolist() == [0.5]


# The fixture's first-week TTL-only tallies, as `fixture_release.write_simulation` writes them, per scope in TTL order:
# missed tokens and reusable plus dead token-seconds. The span is 603,200 s for Agentic and 25 s for SWE-Bench.
AGENTIC_MISSES = [5_000, 4_000, 2_000, 1_600]
AGENTIC_RETAINED = [400 + 100, 1_000 + 500, 3_000 + 2_000, 3_600 + 5_000_000]
BENCHMARK_MISSES = [1_200, 1_000, 500, 400]
BENCHMARK_RETAINED = [80 + 20, 100 + 50, 150 + 80, 160 + 200]
SIMULATED_TTLS = ["1m", "5m", "1h", "none"]  # the fixture's TTLs, shortest first


def test_prefill_against_storage_per_scope_and_ttl(connection: duckdb.DuckDBPyConnection,
                                                    fixture_weeks: list[str]) -> None:
    # The second week is not simulated, so only the first week's tallies count; the prefill is normalised by each
    # scope's misses with no TTL, the retained tokens by its span.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/prefill_against_storage")
    agentic = rows[rows.scope == "Agentic"]
    benchmark = rows[rows.scope == "SWE-Bench"]
    assert agentic.ttl.tolist() == SIMULATED_TTLS
    assert agentic.normalised_prefill.tolist() == pytest.approx([misses / 1_600 for misses in AGENTIC_MISSES])
    assert agentic.mean_retained_tokens.tolist() == pytest.approx([retained / 603_200 for retained in AGENTIC_RETAINED])
    assert benchmark.ttl.tolist() == SIMULATED_TTLS
    assert benchmark.normalised_prefill.tolist() == pytest.approx([misses / 400 for misses in BENCHMARK_MISSES])
    assert benchmark.mean_retained_tokens.tolist() == pytest.approx([retained / 25 for retained in BENCHMARK_RETAINED])
    # The replayed top-level requests of the first week: `tree-root` 5 and `idle-week-1` 3; `swe-bench` 2.
    assert agentic.rows.unique().tolist() == [8]
    assert benchmark.rows.unique().tolist() == [2]


def test_prefill_against_storage_ignores_the_harness_selection_and_skips_weeks_not_simulated(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    every_paper_harness = site_database.run_query(connection, "figures/prefill_against_storage")
    site_database.select_weeks(connection, fixture_weeks, ["pi"])
    assert site_database.run_query(connection, "figures/prefill_against_storage").equals(every_paper_harness)
    site_database.select_weeks(connection, [SECOND_SUNDAY], fixture_release.PAPER_HARNESSES)
    assert site_database.run_query(connection, "figures/prefill_against_storage").empty


# The fixture's first-week Agentic tallies at the TTLs a cost figure draws, 1m, 5m and 1h, and with no TTL, with its
# 1,300 output tokens, priced in millionths of a dollar: missed tokens at 10, hit tokens at 1 and output tokens at 50
# (the API's prices), and missed tokens at 1 and token-seconds at 30 a token-day (the infrastructure's).
API_PARTS = {  # per TTL: missed input, cache reads, output
    "1m": (5_000 * 10, 5_000 * 1, 1_300 * 50), "5m": (4_000 * 10, 6_000 * 1, 1_300 * 50),
    "1h": (2_000 * 10, 8_000 * 1, 1_300 * 50),
}
INFRASTRUCTURE_PARTS = {  # per TTL: recompute, storage
    "1m": (5_000 * 1, 500 * 30 / 86_400), "5m": (4_000 * 1, 1_500 * 30 / 86_400),
    "1h": (2_000 * 1, 5_000 * 30 / 86_400),
}
DRAWN_TTLS = ["1m", "5m", "1h"]  # the fixture's TTLs up to a day, shortest first


def part_rows(rows: pandas.DataFrame, part: str) -> pandas.DataFrame:
    """A cost query's rows of one part, indexed by TTL."""
    return rows[rows.part == part].set_index("ttl")


def test_the_api_cost_of_each_part_is_a_multiple_of_the_one_minute_total(connection: duckdb.DuckDBPyConnection,
                                                                         fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/api_cost_by_ttl")
    assert rows.part.unique().tolist() == ["cache_read", "input", "output"]
    minute_total = sum(API_PARTS["1m"])
    for index, part in enumerate(["input", "cache_read", "output"]):
        costs = part_rows(rows, part)
        assert costs.index.tolist() == DRAWN_TTLS  # no TTL is not drawn
        assert costs.ttl_seconds.tolist() == [60, 300, 3_600]
        expected = [API_PARTS[ttl][index] / minute_total for ttl in DRAWN_TTLS]
        assert costs.cost_multiple.tolist() == pytest.approx(expected)
    assert part_rows(rows, "input").total_multiple.tolist() == pytest.approx([1, 111_000 / 120_000, 93_000 / 120_000])
    assert rows.rows.unique().tolist() == [8]  # the first week's top-level requests of `tree-root` and `idle-week-1`


def test_the_knee_is_the_shortest_ttl_within_5_percent_of_the_lowest_api_cost(connection: duckdb.DuckDBPyConnection,
                                                                               fixture_weeks: list[str]) -> None:
    # The lowest total is no TTL's, 89,400 / 120,000; the hour's, 93,000, is within 5% of it and the first that is.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/api_cost_by_ttl")
    assert rows[rows.is_knee].ttl.unique().tolist() == ["1h"]


def test_the_infrastructure_cost_of_each_part_and_its_lowest_ttl(connection: duckdb.DuckDBPyConnection,
                                                                 fixture_weeks: list[str]) -> None:
    # With no TTL, storing 5,003,600 token-seconds costs more than recomputing what an hour's TTL misses.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/infrastructure_cost_by_ttl")
    minute_total = sum(INFRASTRUCTURE_PARTS["1m"])
    for index, part in enumerate(["recompute", "storage"]):
        costs = part_rows(rows, part)
        assert costs.index.tolist() == DRAWN_TTLS
        expected = [INFRASTRUCTURE_PARTS[ttl][index] / minute_total for ttl in DRAWN_TTLS]
        assert costs.cost_multiple.tolist() == pytest.approx(expected)
    assert rows[rows.is_lowest].ttl.unique().tolist() == ["1h"]
    hour_total = sum(INFRASTRUCTURE_PARTS["1h"]) / minute_total
    assert part_rows(rows, "storage").total_multiple["1h"] == pytest.approx(hour_total)


# Agentic tallies of one week whose lowest API cost is no TTL's, with no drawn TTL within 5% of it: a cache of 10,000
# input tokens and no output costs 10,000 plus 9 per missed token.
NO_TTL_CHEAPEST = pandas.DataFrame({
    "week": [FIRST_SUNDAY] * 4,
    "scope": ["Agentic"] * 4,
    "ttl": ["1m", "5m", "1h", "none"],
    "hit_tokens": [5_000, 8_500, 8_700, 9_000],
    "miss_tokens": [5_000, 1_500, 1_300, 1_000],
    "reusable_token_seconds": [0.0] * 4,
    "dead_token_seconds": [0.0] * 4,
    "output_tokens": [0.0] * 4,
})


def test_the_knee_is_chosen_among_every_ttl_so_no_drawn_ttl_is_it_when_only_no_ttl_is_near_the_lowest(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    # No TTL costs 19,000; the hour, 21,700, is more than 5% above it, though it would be the knee among the drawn TTLs.
    connection.register("no_ttl_cheapest", NO_TTL_CHEAPEST)
    connection.execute("CREATE OR REPLACE VIEW simulation AS SELECT * FROM no_ttl_cheapest")
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/api_cost_by_ttl")
    assert part_rows(rows, "input").total_multiple["1h"] == pytest.approx(21_700 / 55_000)
    assert not rows.is_knee.any()


def test_the_cost_figures_ignore_the_harness_selection_and_skip_weeks_not_simulated(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    for name in ["figures/api_cost_by_ttl", "figures/infrastructure_cost_by_ttl"]:
        site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
        every_paper_harness = site_database.run_query(connection, name)
        site_database.select_weeks(connection, fixture_weeks, fixture_release.BENCHMARK_HARNESSES)
        assert site_database.run_query(connection, name).equals(every_paper_harness), name
        site_database.select_weeks(connection, [SECOND_SUNDAY], fixture_release.PAPER_HARNESSES)
        assert site_database.run_query(connection, name).empty, name
