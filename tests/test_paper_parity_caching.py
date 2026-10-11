"""The Prefix-caching figures give the paper's numbers: with every week and the paper's harnesses selected, each
number a figure shares with the paper's `numbers.json` is equal, as `test_paper_parity.py` compares the others.

It is skipped when the full site data or `numbers.json` is missing, as `test_paper_parity.py` is.
"""

import json
import typing

import duckdb
import pytest

from paper.metrics import gaps

import site_database
import test_paper_parity

SECTION = "prefix_caching"  # the section of `numbers.json` every compared item is in
COMPARED_ITEMS = ["hit_ratio_by_gap_bin", "gap_by_cause", "mean_hit_ratio_by_cause", "hit_ratio_after_transition"]
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

