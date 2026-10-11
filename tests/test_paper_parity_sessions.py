"""The site's Sessions figures that rank sessions give the paper's numbers, and its rank bins: each number such a
figure shares with the paper's `numbers.json` is equal, and each rank bin equals the pipeline's `binning.rank_bins`
over the same sessions.

The queries run as the browser runs them, on the full site data with every week and the paper's harnesses selected,
as `test_paper_parity.py` sets it up; like it, these tests are skipped when the full site data or `numbers.json` is
missing. The pipeline's own functions compute the rank bins from the site's requests of the same selection.
"""

import duckdb
import pandas

import site_database
from paper.metrics import binning, tokens
# `agentic` and `paper_numbers` are fixtures: importing them is what makes them this module's too.
from test_paper_parity import RELATIVE_TOLERANCE, Comparison, agentic, assert_match, paper_numbers

# Absolute; a bin's mean share comes out of DuckDB and of pandas with float rounding, no more.
SHARE_TOLERANCE = 1e-9
COST_PARTS = ["cached", "uncached", "output"]  # the cost share's parts, each a column of its rows

# The rows of the selection the pipeline's functions read: the top-level requests of the selected weeks and harnesses,
# in session and step order, as the pipeline's population holds them.
SELECTED_REQUESTS = """
SELECT *
FROM requests
WHERE is_top_level
  AND week IN (SELECT week FROM selected_weeks)
  AND harness IN (SELECT harness FROM selected_harnesses)
ORDER BY session_id, step
"""

# The scope `numbers.json` records with each item compared here, by section and item: the tests select its harnesses.
PAPER_SCOPES = {
    ("sessions", "cost_share_by_session"): "Agentic",
}


def test_the_paper_counts_each_compared_item_in_the_scope_the_test_selects(paper_numbers: dict) -> None:
    for (section, item), scope in PAPER_SCOPES.items():
        assert paper_numbers[section][item]["scope"] == scope, f"{section}.{item}"


def selected_requests(connection: duckdb.DuckDBPyConnection) -> pandas.DataFrame:
    """The selection's top-level requests, every column, in session and step order."""
    return connection.sql(SELECTED_REQUESTS).df()


def assert_bins_match(site_rows: pandas.DataFrame, pipeline_bins: pandas.DataFrame, columns: list[str]) -> None:
    """Fail unless the site's rank bins have the pipeline's percentiles and, per column, its shares."""
    assert len(site_rows) == len(pipeline_bins)
    for column in ["percentile", *columns]:
        site_values = site_rows[column].tolist()
        pipeline_values = pipeline_bins[column].tolist()
        for bin_number, (site_value, pipeline_value) in enumerate(zip(site_values, pipeline_values)):
            assert abs(site_value - pipeline_value) <= SHARE_TOLERANCE, f"{column}, bin {bin_number}"


def test_the_pooled_cost_shares(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/cost_share_by_session`'s `pooled_cached`, `pooled_uncached` and `pooled_output`, the same on every
    # row, against `sessions.cost_share_by_session.pooled_cached`, `.pooled_uncached` and `.pooled_output`.
    first_row = site_database.run_query(agentic, "figures/cost_share_by_session").iloc[0]
    assert_match(paper_numbers, [
        Comparison("sessions", "cost_share_by_session", f"pooled_{part}", float(first_row[f"pooled_{part}"]),
                   RELATIVE_TOLERANCE)
        for part in COST_PARTS])


def test_the_cost_share_bins_are_the_pipeline_s_rank_bins(agentic: duckdb.DuckDBPyConnection) -> None:
    site_rows = site_database.run_query(agentic, "figures/cost_share_by_session")
    shares = tokens.cost_shares_per_session(selected_requests(agentic))
    assert_bins_match(site_rows, binning.rank_bins(shares, ["cached", "uncached"]), COST_PARTS)
