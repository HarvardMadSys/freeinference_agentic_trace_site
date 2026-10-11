"""The Explore page's figure queries on the fixture data: the CDFs' shape, the colour orders, and each figure's rows."""

import duckdb
import pytest

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
# The CDF queries, each with the series it draws: one row per series and point.
CDF_SERIES = {
    "figures/requests_per_session_cdf": ["requests", "tool_steps", "user_steps"],
    "figures/duration_cdf": ["session", "turn"],
    "figures/tokens_per_request_cdf": ["input", "output", "uncached"],
    "figures/ttft_cdf_by_model": ["model-x", "model-y"],
}
CDF_POINTS = 201  # every CDF series has this many points, its share running evenly from 0 to 1
# How far a CDF's x may fall from one point to the next, relative to its value: quantile_cont interpolates between
# two equal values with a rounding error of about one unit in the last place, which no chart can show.
CDF_ROUNDING = 1e-12

# The columns of the setup queries that fix a colour order, by name. They read no selection: an order is the same on
# every page and for every selection, so a name keeps its colour.
COLOUR_ORDER_COLUMNS = {
    "setup/model_order": ["model", "requests"],
    "setup/category_order": ["category", "calls"],
}




@pytest.mark.parametrize("name", sorted(CDF_SERIES))
def test_a_cdf_runs_from_0_to_1_in_even_steps_with_x_never_falling(connection: duckdb.DuckDBPyConnection,
                                                                   fixture_weeks: list[str], name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, name)
    assert sorted(rows.series.unique()) == CDF_SERIES[name]
    for series, points in rows.groupby("series"):
        assert points.share.tolist() == pytest.approx([step / (CDF_POINTS - 1) for step in range(CDF_POINTS)]), series
        steps = points.x.diff().dropna()
        assert (steps >= -CDF_ROUNDING * points.x.abs().iloc[1:]).all(), series
        assert points.rows.nunique() == 1, series


@pytest.mark.parametrize("name", sorted(CDF_SERIES))
def test_a_cdf_of_no_weeks_has_no_rows(connection: duckdb.DuckDBPyConnection, name: str) -> None:
    site_database.select_weeks(connection, [], fixture_release.EVERY_HARNESS)
    assert site_database.run_query(connection, name).empty


# Top-level sessions of the fixture's paper harnesses over both weeks, with their requests, user steps and tool steps,
# counted by hand from `fixture_release.REQUESTS`: `tree-root` 5, `idle-week-1` 3, `mutation` 3, `idle-week-2` 2.
AGENTIC_SESSIONS = 4
MEDIAN_REQUESTS_PER_AGENTIC_SESSION = 3.0


def test_the_requests_per_session_cdf_crosses_one_half_at_the_median(connection: duckdb.DuckDBPyConnection,
                                                                     fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/requests_per_session_cdf")
    requests = rows[rows.series == "requests"]
    assert requests.rows.tolist() == [AGENTIC_SESSIONS] * CDF_POINTS
    assert requests[requests.share == 0.5].x.tolist() == [MEDIAN_REQUESTS_PER_AGENTIC_SESSION]


@pytest.mark.parametrize("name", sorted(COLOUR_ORDER_COLUMNS))
def test_a_colour_order_lists_every_value_largest_first(connection: duckdb.DuckDBPyConnection, name: str) -> None:
    rows = site_database.run_query(connection, name)
    assert list(rows.columns) == COLOUR_ORDER_COLUMNS[name]
    counts = rows.iloc[:, 1].tolist()
    assert counts == sorted(counts, reverse=True)
    assert rows.iloc[:, 0].is_unique


def test_the_colour_orders_ignore_the_selection(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_weeks(connection, [], [])
    for name in COLOUR_ORDER_COLUMNS:
        assert not site_database.run_query(connection, name).empty, name


def test_the_token_split_counts_only_requests_whose_provider_reports_cache_reads(
        connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    # Of the benchmark's sessions, `swe-bench` runs at a provider that reports no cache reads; `idle-benchmark`, in the
    # second week, reads none of its 600 input tokens from cache and writes 100 output tokens.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.BENCHMARK_HARNESSES)
    rows = site_database.run_query(connection, "figures/token_split_by_week")
    shares = dict(zip(rows.part, rows.share))
    assert rows.week.unique().tolist() == [SECOND_SUNDAY]
    assert rows.rows.unique().tolist() == [1]
    assert shares == pytest.approx({"cached": 0.0, "uncached": 600 / 700, "output": 100 / 700})


def test_each_week_s_token_parts_sum_to_one(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/token_split_by_week")
    assert rows.groupby("week").share.sum().tolist() == pytest.approx([1.0, 1.0])


# The fixture's requests have 2 * step + 2 messages, so steps 0, 1 and 2, 3 and 4 fall in the bins from 2, 4 and 8
# messages. Of its sixteen top-level requests, the two of `swe-bench` report no cache reads; of the other fourteen,
# five are at step 0, seven at step 1 or 2, and two (`tree-root`'s, with 3,000 and 4,000 cached of 4,000 and 5,000
# input tokens) at step 3 or 4.
GROWTH_BIN_ROWS = {2: 5, 4: 7, 8: 2}


def test_token_growth_bins_by_powers_of_two_of_messages(connection: duckdb.DuckDBPyConnection,
                                                        fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/token_growth_by_messages")
    assert dict(zip(rows.bin_start, rows.rows)) == GROWTH_BIN_ROWS
    last_bin = rows[rows.bin_start == 8].iloc[0]
    assert (last_bin.median_cached_tokens, last_bin.median_uncached_tokens) == (3500, 1000)


def test_each_input_bin_s_role_shares_sum_to_one(connection: duckdb.DuckDBPyConnection,
                                                 fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/context_share_by_role")
    assert sorted(rows.role.unique()) == ["assistant", "system", "tool", "tool_definitions", "user"]
    assert rows.groupby("bin_start").share.sum().tolist() == pytest.approx([1.0] * rows.bin_start.nunique())
    assert rows.drop_duplicates("bin_start").rows.sum() == 16  # every top-level request has role tokens


def test_the_ttft_cdf_keeps_only_trusted_ttfts(connection: duckdb.DuckDBPyConnection,
                                               fixture_weeks: list[str]) -> None:
    # The paper's harnesses' thirteen top-level requests all run on `model-x`; `tree-root`'s step 2 has a TTFT of 99%
    # of its latency and its step 3 none, so eleven TTFTs are trusted.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/ttft_cdf_by_model")
    assert rows.series.unique().tolist() == ["model-x"]
    assert rows.rows.unique().tolist() == [11]


def test_the_ttft_median_counts_only_trusted_ttfts(connection: duckdb.DuckDBPyConnection,
                                                   fixture_weeks: list[str]) -> None:
    # The same eleven trusted TTFTs of `model-x` as the CDF's, of the paper's harnesses.
    site_database.select_weeks(connection, fixture_weeks, fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "figures/ttft_median_by_model")
    assert rows.model.tolist() == ["model-x"]
    assert rows.rows.tolist() == [11]



# every depth: read 6, bash 6 (*Build/Test), task 3 (Subagent), edit 1. A tie is broken by name, and "*" sorts first.
def test_the_category_order_counts_every_call_largest_first(connection: duckdb.DuckDBPyConnection) -> None:
    rows = site_database.run_query(connection, "setup/category_order")
    assert rows.values.tolist() == [["*Build/Test", 6], ["Read", 6], ["Subagent", 3], ["Edit", 1]]


# The fixture's two `task` calls (Subagent) are one request's, so Subagent has no single-call latency. Read's single calls wait 10 s (`tree-root` step 0), 20 s and 5 s (`idle-week-1` steps 0 and 1) and 170 s
# (`mutation` step 1) before the next request.
MEDIAN_READ_LATENCY_MS = 15_000
PERCENTILE_COLUMNS = ["p5", "p25", "p50", "p75", "p95"]


@pytest.mark.parametrize("name", ["figures/latency_by_category", "figures/result_tokens_by_category"])
def test_a_category_s_percentiles_never_fall(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str],
                                            name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, name)
    assert not rows.empty
    for row in rows.itertuples():
        percentiles = [getattr(row, column) for column in PERCENTILE_COLUMNS]
        assert percentiles == sorted(percentiles), row.category


def test_latency_counts_only_calls_that_were_their_request_s_only_call(connection: duckdb.DuckDBPyConnection,
                                                                       fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, "figures/latency_by_category").set_index("category")
    assert "Subagent" not in rows.index
    assert rows.rows["Read"] == 4
    assert rows.p50["Read"] == MEDIAN_READ_LATENCY_MS
