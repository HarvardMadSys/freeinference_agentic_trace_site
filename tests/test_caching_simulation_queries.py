"""The Prefix-caching figures of the cache simulation on the fixture data: prefill against storage of both scopes, and
the API and infrastructure costs per TTL of the paper's harnesses, with the TTL each calls out."""

import duckdb
import pandas
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]  # the week the fixture did not simulate


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


# Two simulated weeks: the paper's harnesses in both, the benchmark replay in the first only. Every TTL row of a week
# repeats its scope's span and output tokens, which must be summed once per week and scope, not once per row.
TWO_WEEKS = ["2026-07-05", "2026-07-12"]
TWO_WEEK_TALLIES = pandas.DataFrame({
    "week": [TWO_WEEKS[0]] * 4 + [TWO_WEEKS[1]] * 4 + [TWO_WEEKS[0]] * 4,
    "scope": ["Agentic"] * 8 + ["SWE-Bench"] * 4,
    "ttl": ["1m", "5m", "1h", "none"] * 3,
    "hit_tokens": [50, 60, 80, 90] * 2 + [5, 6, 8, 9],
    "miss_tokens": [50, 40, 20, 10] * 2 + [5, 4, 2, 1],
    "reusable_token_seconds": [100.0, 200.0, 300.0, 400.0] + [300.0, 600.0, 900.0, 1_200.0] + [40.0] * 4,
    "dead_token_seconds": [0.0] * 12,
    "span_seconds": [100.0] * 4 + [300.0] * 4 + [20.0] * 4,
    "output_tokens": [10.0] * 4 + [30.0] * 4 + [1.0] * 4,
})
# Top-level requests: two of the paper's harnesses in the first week and one in the second; one benchmark request in
# each week, the second of which the simulation did not replay.
TWO_WEEK_REQUESTS = pandas.DataFrame({
    "week": [TWO_WEEKS[0], TWO_WEEKS[0], TWO_WEEKS[1], TWO_WEEKS[0], TWO_WEEKS[1]],
    "harness": ["pi", "pi", "codex", "eval:swe-bench", "eval:swe-bench"],
    "is_top_level": [True] * 5,
})


def two_week_simulation() -> duckdb.DuckDBPyConnection:
    """A database whose `simulation` and `requests` are the two-week cases, both weeks and the paper's harnesses
    selected, and `eval:swe-bench` the benchmark harness."""
    database = duckdb.connect()
    database.register("simulation", TWO_WEEK_TALLIES)
    database.register("requests", TWO_WEEK_REQUESTS)
    for name in [*site_database.SELECTION_TABLE_STATEMENTS, site_database.BENCHMARK_TABLE_STATEMENT]:
        database.execute(site_database.statement_text(name))
    database.execute(site_database.statement_text("setup/insert_benchmark_harness"), ["eval:swe-bench"])
    site_database.select_weeks(database, TWO_WEEKS, ["pi", "codex"])
    return database


def test_two_simulated_weeks_sum_each_scope_s_span_and_output_once_per_week() -> None:
    database = two_week_simulation()
    prefill = site_database.run_query(database, "figures/prefill_against_storage").set_index(["scope", "ttl"])
    # Spans 100 + 300 s for the paper's harnesses, 20 s for the benchmark; at 1m, 100 + 300 retained token-seconds.
    assert prefill.mean_retained_tokens[("Agentic", "1m")] == pytest.approx(400 / 400)
    assert prefill.mean_retained_tokens[("SWE-Bench", "1m")] == pytest.approx(40 / 20)
    assert prefill.normalised_prefill[("Agentic", "1m")] == pytest.approx(100 / 20)
    assert prefill.rows[("Agentic", "1m")] == 3 and prefill.rows[("SWE-Bench", "1m")] == 1
    api = site_database.run_query(database, "figures/api_cost_by_ttl")
    output_at_minute = api[(api.part == "output") & (api.ttl == "1m")].cost_multiple.iloc[0]
    # At 1m: 100 missed tokens at 10, 100 hits at 1, and 10 + 30 output tokens at 50.
    assert output_at_minute == pytest.approx(40 * 50 / (100 * 10 + 100 * 1 + 40 * 50))
    database.close()
