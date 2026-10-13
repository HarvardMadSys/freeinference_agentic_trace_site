"""The site's Sessions figures that rank sessions or split latency give the paper's numbers: each number such a
figure shares with the paper's `numbers.json` is equal, and each rank bin equals the pipeline's `binning.rank_bins`
over the same sessions, the session time's user share being the pipeline's human share.

The decode time figure draws the five models with most requests, where the paper decomposes two chosen models:
`decode_median_by_model` compares the paper's two, and each model the figure draws has that query's median.

The numbers are read from the shipped answers, which `make data` wrote with every week and the paper's harnesses
selected; like `test_paper_parity.py`, these tests are skipped when the shipped answers or `numbers.json` is missing.
The pipeline's own functions compute the rank bins from the paper's population in the pipeline's release, every
week's top-level sessions of the Agentic scope; those tests are skipped when the release is missing.
"""

import math

import pandas
import pytest

from paper.metrics import binning, latency, tokens
from release import population, reader
from test_paper_parity import (MEDIAN_SHARE, RELATIVE_TOLERANCE, TTFT_MODELS, Comparison, answer, assert_match,
                               cdf_point, release_folder)

# Absolute; a bin's mean share comes out of DuckDB and of pandas with float rounding, no more.
SHARE_TOLERANCE = 1e-9
COST_PARTS = ["cached", "uncached", "output"]  # the cost share's parts, each a column of its rows
# The session time's parts, each a column of its rows, by the name the pipeline gives the part.
TIME_PARTS = {"prefill": "prefill", "decode": "decode", "tool": "tool", "user": "human"}

# The scope `numbers.json` records with each item compared here, by section and item: the answers were written over
# its harnesses.
PAPER_SCOPES = {
    ("sessions", "cost_share_by_session"): "Agentic",
    ("sessions", "session_time_breakdown"): "Agentic",
    ("sessions", "speedup_if_twice_as_fast"): "Agentic",
}


def test_the_paper_counts_each_compared_item_in_the_scope_the_test_selects(paper_numbers: dict) -> None:
    for (section, item), scope in PAPER_SCOPES.items():
        assert paper_numbers[section][item]["scope"] == scope, f"{section}.{item}"


@pytest.fixture(scope="module")
def paper_requests() -> pandas.DataFrame:
    """The requests of the paper's population in the pipeline's release: every week's top-level sessions of the
    Agentic scope, in session and step order."""
    if not release_folder().exists():
        pytest.skip(f"the rank-bin parity test needs {release_folder()}, which is missing")
    release = reader.load(release_folder())
    return population.sessions_in_scope(release, population.AGENTIC).requests


def assert_bins_match(site_rows: pandas.DataFrame, pipeline_bins: pandas.DataFrame, columns: list[str]) -> None:
    """Fail unless the site's rank bins have the pipeline's percentiles and, per column, its shares."""
    assert len(site_rows) == len(pipeline_bins)
    for column in ["percentile", *columns]:
        site_values = site_rows[column].tolist()
        pipeline_values = pipeline_bins[column].tolist()
        for bin_number, (site_value, pipeline_value) in enumerate(zip(site_values, pipeline_values)):
            assert abs(site_value - pipeline_value) <= SHARE_TOLERANCE, f"{column}, bin {bin_number}"


def test_the_pooled_cost_shares(paper_numbers: dict) -> None:
    # `figures/cost_share_by_session`'s `pooled_cached`, `pooled_uncached` and `pooled_output`, the same on every
    # row, against `sessions.cost_share_by_session.pooled_cached`, `.pooled_uncached` and `.pooled_output`.
    first_row = answer("figures/cost_share_by_session").iloc[0]
    assert_match(paper_numbers, [
        Comparison("sessions", "cost_share_by_session", f"pooled_{part}", float(first_row[f"pooled_{part}"]),
                   RELATIVE_TOLERANCE)
        for part in COST_PARTS])


def test_the_cost_share_bins_are_the_pipeline_s_rank_bins(paper_requests: pandas.DataFrame) -> None:
    site_rows = answer("figures/cost_share_by_session")
    shares = tokens.cost_shares_per_session(paper_requests)
    assert_bins_match(site_rows, binning.rank_bins(shares, ["cached", "uncached"]), COST_PARTS)


def test_the_median_decode_time_of_the_paper_s_models(paper_numbers: dict) -> None:
    # `figures/decode_median_by_model`'s `median_decode_s` of each model against
    # `sessions.ttft_decomposition_<model>.median_decode_s`.
    medians = answer("figures/decode_median_by_model").set_index("model").median_decode_s
    assert_match(paper_numbers, [
        Comparison("sessions", f"ttft_decomposition_{model}", "median_decode_s", float(medians[model]),
                   RELATIVE_TOLERANCE)
        for model in TTFT_MODELS])


def test_the_decode_cdf_s_median_is_the_decode_median_of_each_model_it_draws() -> None:
    # `figures/decode_cdf_by_model`'s `x` at share 0.5 of each model it draws against that model's `median_decode_s`
    # in `figures/decode_median_by_model`, which the test above compares with the paper.
    rows = answer("figures/decode_cdf_by_model")
    medians = answer("figures/decode_median_by_model").set_index("model").median_decode_s
    for model in rows.series.unique():
        assert math.isclose(cdf_point(rows, model, MEDIAN_SHARE), medians[model], rel_tol=RELATIVE_TOLERANCE), model


def test_the_mean_shares_of_session_time(paper_numbers: dict) -> None:
    # `figures/session_time_by_part`'s `mean_prefill_share`, `mean_decode_share`, `mean_tool_share` and
    # `mean_user_share`, the same on every row, against `sessions.session_time_breakdown.mean_prefill_share`,
    # `.mean_decode_share`, `.mean_tool_share` and `.mean_human_share`.
    first_row = answer("figures/session_time_by_part").iloc[0]
    assert_match(paper_numbers, [
        Comparison("sessions", "session_time_breakdown", f"mean_{paper_part}_share",
                   float(first_row[f"mean_{part}_share"]), RELATIVE_TOLERANCE)
        for part, paper_part in TIME_PARTS.items()])


def test_the_session_time_bins_are_the_pipeline_s_rank_bins(paper_requests: pandas.DataFrame) -> None:
    site_rows = answer("figures/session_time_by_part")
    pipeline_bins = binning.rank_bins(latency.time_shares(paper_requests), ["human", "tool"])
    assert_bins_match(site_rows, pipeline_bins.rename(columns={"human": "user"}), list(TIME_PARTS))


def test_the_speedup_if_twice_as_fast(paper_numbers: dict) -> None:
    # `figures/speedup_if_twice_as_fast`'s `speedup` of each part against
    # `sessions.speedup_if_twice_as_fast.prefill_speedup`, `.decode_speedup` and `.tool_speedup`.
    speedups = answer("figures/speedup_if_twice_as_fast").set_index("part").speedup
    assert_match(paper_numbers, [
        Comparison("sessions", "speedup_if_twice_as_fast", f"{part}_speedup", float(speedups[part]), RELATIVE_TOLERANCE)
        for part in ["prefill", "decode", "tool"]])
