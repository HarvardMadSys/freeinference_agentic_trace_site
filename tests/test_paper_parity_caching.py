"""The Prefix-caching figures give the paper's numbers: with every week and the paper's harnesses selected, each
number a figure shares with the paper's `numbers.json` is equal, as `test_paper_parity.py` compares the others.

It is skipped when the full site data or `numbers.json` is missing, as `test_paper_parity.py` is.
"""

import json
import typing

import duckdb
import pandas
import pytest

from paper.metrics import cache_costs, gaps, mutations
from paper.prefix_caching import cache_retention

import site_database
import test_paper_parity

SECTION = "prefix_caching"  # the section of `numbers.json` every compared item is in
COMPARED_ITEMS = ["hit_ratio_by_gap_bin", "gap_by_cause", "mean_hit_ratio_by_cause", "hit_ratio_after_transition",
                  "prefill_against_storage", "api_cost", "infrastructure_cost", "mutations_by_cause"]
BENCHMARK_SECTION = "benchmark_vs_production"  # the section comparing the benchmark replay with the paper's harnesses
BENCHMARK_SCOPE = "Agentic and SWE-Bench"  # the scope `numbers.json` records with the benchmark section's items
TRANSITIONS = ["append", "mutation"]  # the transitions whose median hit ratio the paper reports
PAPER_SCOPE = "Agentic"  # the scope `numbers.json` records with each compared item: the paper's harnesses


@pytest.fixture(scope="module")
def paper_numbers() -> dict:
    """The paper's `numbers.json`: section, then item, then name."""
    test_paper_parity.skip_unless_inputs_exist()
    return json.loads(test_paper_parity.numbers_file().read_text())


@pytest.fixture(scope="module")
def agentic() -> typing.Iterator[duckdb.DuckDBPyConnection]:
    """The full data with every week and the paper's harnesses, every one but the benchmark's, selected."""
    connection = test_paper_parity.selected_database(benchmark=False)
    yield connection
    connection.close()


def comparison(item: str, name: str, site_value: float) -> test_paper_parity.Comparison:
    """A comparison of `prefix_caching.<item>.<name>` with the site's value, up to float rounding."""
    return test_paper_parity.Comparison(SECTION, item, name, site_value, test_paper_parity.RELATIVE_TOLERANCE)


def test_the_paper_counts_each_compared_item_over_its_harnesses(paper_numbers: dict) -> None:
    for item in COMPARED_ITEMS:
        assert paper_numbers[SECTION][item]["scope"] == PAPER_SCOPE, item


def test_the_median_hit_ratio_of_each_gap_bin(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/hit_ratio_cdf_by_gap_bin`'s `x` at share 0.5 of each bin's series, named by its label, against
    # `prefix_caching.hit_ratio_by_gap_bin.median_hit_ratio_<bin name>`.
    rows = site_database.run_query(agentic, "figures/hit_ratio_cdf_by_gap_bin")
    test_paper_parity.assert_match(paper_numbers, [
        comparison("hit_ratio_by_gap_bin", f"median_hit_ratio_{name}",
                   test_paper_parity.cdf_point(rows, label, test_paper_parity.MEDIAN_SHARE))
        for name, label, _lower, _upper in gaps.GAP_BINS])


def test_the_median_gap_of_each_cause(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/gap_cdf_by_cause`'s `x` at share 0.5 of each cause's series against
    # `prefix_caching.gap_by_cause.median_gap_s_<waited_for>`.
    rows = site_database.run_query(agentic, "figures/gap_cdf_by_cause")
    test_paper_parity.assert_match(paper_numbers, [
        comparison("gap_by_cause", f"median_gap_s_{cause}",
                   test_paper_parity.cdf_point(rows, cause, test_paper_parity.MEDIAN_SHARE))
        for cause in gaps.CAUSE_NAMES])


def test_the_mean_hit_ratio_of_each_cause(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/mean_hit_ratio_by_cause`'s `mean_hit_ratio` of each cause against
    # `prefix_caching.mean_hit_ratio_by_cause.mean_hit_ratio_<waited_for>`.
    means = site_database.run_query(agentic, "figures/mean_hit_ratio_by_cause").set_index("waited_for").mean_hit_ratio
    test_paper_parity.assert_match(paper_numbers, [
        comparison("mean_hit_ratio_by_cause", f"mean_hit_ratio_{cause}", float(means[cause]))
        for cause in gaps.CAUSE_NAMES])


def test_the_median_hit_ratio_after_each_transition(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/hit_ratio_cdf_by_transition`'s `x` at share 0.5 of the series `append` and `mutation` against
    # `prefix_caching.hit_ratio_after_transition.median_hit_ratio_append` and `_mutation`.
    rows = site_database.run_query(agentic, "figures/hit_ratio_cdf_by_transition")
    test_paper_parity.assert_match(paper_numbers, [
        comparison("hit_ratio_after_transition", f"median_hit_ratio_{transition}",
                   test_paper_parity.cdf_point(rows, transition, test_paper_parity.MEDIAN_SHARE))
        for transition in TRANSITIONS])



def prefill_curves(agentic: duckdb.DuckDBPyConnection) -> dict[str, pandas.DataFrame]:
    """`figures/prefill_against_storage`'s rows of each scope, indexed by TTL, by scope."""
    rows = site_database.run_query(agentic, "figures/prefill_against_storage")
    return {scope: scope_rows.set_index("ttl") for scope, scope_rows in rows.groupby("scope")}


def test_the_prefill_above_the_floor_and_the_retained_tokens_of_the_paper_s_harnesses(
        agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # The `Agentic` rows' `normalised_prefill` minus one at each TTL the paper quotes, against
    # `prefix_caching.prefill_against_storage.prefill_above_floor_<ttl>`, and their `mean_retained_tokens` at each TTL
    # it compares over those at 15 minutes, against `retained_<ttl>_over_15m`.
    curve = prefill_curves(agentic)["Agentic"]
    comparisons = []
    for ttl in cache_retention.PREFILL_TTLS:
        prefill_above_floor = float(curve.normalised_prefill[ttl] - 1)
        comparisons.append(comparison("prefill_against_storage", f"prefill_above_floor_{ttl}", prefill_above_floor))
    reference = curve.mean_retained_tokens[cache_costs.REFERENCE_TTL]
    for ttl in cache_retention.RETAINED_TTLS:
        retained = float(curve.mean_retained_tokens[ttl] / reference)
        comparisons.append(comparison("prefill_against_storage", f"retained_{ttl}_over_{cache_costs.REFERENCE_TTL}",
                                      retained))
    test_paper_parity.assert_match(paper_numbers, comparisons)


def test_the_benchmark_s_prefill_above_the_floor_beside_the_paper_s_harnesses(agentic: duckdb.DuckDBPyConnection,
                                                                               paper_numbers: dict) -> None:
    # The `SWE-Bench` rows' `normalised_prefill` minus one at 1 and 5 minutes, and the `Agentic` rows' at 15 minutes,
    # against `benchmark_vs_production.prefill_against_storage`.
    assert paper_numbers[BENCHMARK_SECTION]["prefill_against_storage"]["scope"] == BENCHMARK_SCOPE
    curves = prefill_curves(agentic)
    site_values = {
        "benchmark_1m_above_floor": curves["SWE-Bench"].normalised_prefill["1m"] - 1,
        "benchmark_5m_above_floor": curves["SWE-Bench"].normalised_prefill["5m"] - 1,
        "production_15m_above_floor": curves["Agentic"].normalised_prefill["15m"] - 1,
    }
    test_paper_parity.assert_match(paper_numbers, [
        test_paper_parity.Comparison(BENCHMARK_SECTION, "prefill_against_storage", name, float(value),
                                     test_paper_parity.RELATIVE_TOLERANCE)
        for name, value in site_values.items()])


def marked_ttl(agentic: duckdb.DuckDBPyConnection, query: str, flag: str) -> tuple[str, float]:
    """The TTL a cost query marks in its column `flag`, and its total as a multiple of the one-minute total."""
    rows = site_database.run_query(agentic, query)
    marked = rows[rows[flag]]
    assert marked.ttl.nunique() == 1, f"{query} marks {marked.ttl.unique().tolist()}"
    return str(marked.ttl.iloc[0]), float(marked.total_multiple.iloc[0])


def test_the_api_cost_s_knee(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/api_cost_by_ttl`'s TTL marked `is_knee` and its `total_multiple` against
    # `prefix_caching.api_cost.knee_ttl` and `knee_cost`.
    ttl, total = marked_ttl(agentic, "figures/api_cost_by_ttl", "is_knee")
    assert ttl == paper_numbers[SECTION]["api_cost"]["knee_ttl"]
    test_paper_parity.assert_match(paper_numbers, [comparison("api_cost", "knee_cost", total)])


def test_the_infrastructure_cost_s_lowest_ttl(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/infrastructure_cost_by_ttl`'s TTL marked `is_lowest` and its `total_multiple` against
    # `prefix_caching.infrastructure_cost.lowest_ttl` and `lowest_cost`.
    ttl, total = marked_ttl(agentic, "figures/infrastructure_cost_by_ttl", "is_lowest")
    assert ttl == paper_numbers[SECTION]["infrastructure_cost"]["lowest_ttl"]
    test_paper_parity.assert_match(paper_numbers, [comparison("infrastructure_cost", "lowest_cost", total)])


def test_the_mutation_table(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/mutations_by_cause`'s `rows` against `prefix_caching.mutations_by_cause.transitions`, exactly, and each
    # row's `steps_share`, `sessions_share` and `prefill_share` in percent against `<row>_steps_percent`,
    # `<row>_sessions_percent` and `<row>_prefill_percent`.
    rows = site_database.run_query(agentic, "figures/mutations_by_cause").set_index("table_row")
    comparisons = [test_paper_parity.Comparison(SECTION, "mutations_by_cause", "transitions",
                                                float(rows.rows.iloc[0]), test_paper_parity.EXACT)]
    for name, _label in mutations.TABLE_ROWS:
        for column, share in [("steps", "steps_share"), ("sessions", "sessions_share"), ("prefill", "prefill_share")]:
            percent = 100 * float(rows[share][name])
            comparisons.append(comparison("mutations_by_cause", f"{name}_{column}_percent", percent))
    test_paper_parity.assert_match(paper_numbers, comparisons)
