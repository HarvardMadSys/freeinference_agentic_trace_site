"""The site's figures give the paper's numbers: every number a figure shares with the paper's `numbers.json` is equal.

The queries run as the browser runs them, on the full site data with every week selected, in the scope the paper
counts each number in (the trace summary over `All`, the benchmark's medians over `SWE-Bench`, the rest over
`Agentic`). The module is skipped when the full site data (`make data`) or the pipeline's `numbers.json` is missing.

A number counted the same way is compared; a count must be equal and a median, share or ratio equal up to
`RELATIVE_TOLERANCE`. These figures draw a number the paper also reports, but define it differently on purpose, so
they are not compared:

- `token_split_by_week` shows plain token shares, where the paper's cost split weights tokens by price;
- `context_share_by_role` takes each role's share of the pooled tokens per message bin, where the paper takes it per
  request and bins the requests;
- `ttft_cdf_by_model` draws the five models with most requests, where the paper draws two chosen models (their
  medians are compared through `ttft_median_by_model` instead);
- `hit_ratio_by_transition` shows mean hit ratios, where the paper reports medians;
- `hit_ratio_by_idle_gap` bins idle gaps by fixed edges and hides thin bins, where the paper merges a thin bin into
  the next, so its per-provider medians at the longest gap fall in other bins;
- `calls_per_request` counts requests, where the paper's batching profile counts calls;
- `tool_overview`'s `sessions` is a count, where the paper gives a share of sessions.
"""

import json
import math
import pathlib
import typing

import duckdb
import pandas
import pytest

import site_database

SITE_DATA_FOLDER = site_database.QUERIES_FOLDER.parent / "data"  # built by `make data` from the full release
SITE_DATA_FILES = ["weeks.json", "requests.parquet", "sessions.parquet", "tool_calls.parquet", "simulation.parquet"]
NUMBERS_FILE = pathlib.Path(
    "/madsys/williamn/dataset_maintain/freeinference-trace/freeinference-agentic-pipeline/figures/v1/numbers.json")

EXACT = 0  # a count matches only when it is equal
RELATIVE_TOLERANCE = 1e-6  # a median, share or ratio may differ by DuckDB's and numpy's float rounding, no more

MEDIAN_SHARE = 0.5  # the CDF point whose `x` is the median
NINETIETH_PERCENTILE_SHARE = 0.9  # the CDF point whose `x` is the 90th percentile
PERCENT = 100  # the paper gives the tool overview's shares in percent
MILLISECONDS_PER_SECOND = 1000  # the site's latencies are in milliseconds, the paper's in seconds
LONGEST_TTL = "1d"  # the TTL at which the paper reports dead over active cache
TTFT_MODELS = ["minimax-m2.7", "kimi-k2.7-code"]  # the models whose TTFT the paper decomposes


class Comparison(typing.NamedTuple):
    """One shared number: its key in `numbers.json` (section, item, name), the site's value and the tolerance."""
    section: str
    item: str
    name: str
    site_value: float
    tolerance: float


def assert_match(paper_numbers: dict, comparisons: list[Comparison]) -> None:
    """Fail, naming every key with the site's and the paper's value, unless each site value equals the paper's."""
    mismatches = []
    for comparison in comparisons:
        paper_value = paper_numbers[comparison.section][comparison.item][comparison.name]
        if not math.isclose(comparison.site_value, paper_value, rel_tol=comparison.tolerance, abs_tol=0):
            key = f"{comparison.section}.{comparison.item}.{comparison.name}"
            mismatches.append(f"{key}: site {comparison.site_value!r}, paper {paper_value!r}")
    if mismatches:
        pytest.fail("the site differs from the paper:\n" + "\n".join(mismatches))


def skip_unless_inputs_exist() -> None:
    """Skip the calling test when a file of the full site data or `numbers.json` is missing, naming it."""
    required = [SITE_DATA_FOLDER / name for name in SITE_DATA_FILES]
    required.append(NUMBERS_FILE)
    for path in required:
        if not path.exists():
            pytest.skip(f"the paper-parity test needs {path}, which is missing")


@pytest.fixture(scope="session")
def paper_numbers() -> dict:
    """The paper's `numbers.json`: section, then item, then name."""
    skip_unless_inputs_exist()
    return json.loads(NUMBERS_FILE.read_text())


def selected_database(scope: str) -> duckdb.DuckDBPyConnection:
    """A database over the full site data with every week of `weeks.json` and the scopes `scope` covers selected."""
    skip_unless_inputs_exist()
    weeks = [entry["week"] for entry in json.loads((SITE_DATA_FOLDER / "weeks.json").read_text())]
    connection = site_database.open_site_database(SITE_DATA_FOLDER.resolve())
    site_database.select_weeks(connection, weeks, site_database.SCOPES_OF[scope])
    return connection


@pytest.fixture(scope="session")
def agentic() -> typing.Iterator[duckdb.DuckDBPyConnection]:
    """The full data with every week and the `Agentic` scope selected."""
    connection = selected_database("Agentic")
    yield connection
    connection.close()


@pytest.fixture(scope="session")
def whole_trace() -> typing.Iterator[duckdb.DuckDBPyConnection]:
    """The full data with every week and the `All` scope selected."""
    connection = selected_database("All")
    yield connection
    connection.close()


@pytest.fixture(scope="session")
def benchmark() -> typing.Iterator[duckdb.DuckDBPyConnection]:
    """The full data with every week and the `SWE-Bench` scope selected."""
    connection = selected_database("SWE-Bench")
    yield connection
    connection.close()


def cdf_point(rows: pandas.DataFrame, series: str, share: float) -> float:
    """The `x` of a CDF query's series at `share`."""
    point = rows[(rows.series == series) & (rows.share == share)]
    assert len(point) == 1, f"{series} has {len(point)} points at share {share}"
    return float(point.x.iloc[0])


# The scope the paper counts each compared item in, by section and item; the tests select the same.
PAPER_SCOPES = {
    ("dataset", "trace_summary"): "All",
    ("sessions", "counts_per_session"): "Agentic",
    ("sessions", "tokens_per_request"): "Agentic",
    ("sessions", "turn_and_session_duration"): "Agentic",
    ("sessions", "ttft_decomposition_minimax-m2.7"): "Agentic",
    ("sessions", "ttft_decomposition_kimi-k2.7-code"): "Agentic",
    ("tools", "tool_overview"): "Agentic",
    ("tools", "latency_by_category"): "Agentic",
    ("tools", "result_tokens_by_category"): "Agentic",
    ("prefix_caching", "retained_over_active"): "Agentic",
    ("prefix_caching", "dead_over_active_by_policy"): "Agentic",
    ("benchmark_vs_production", "turn_duration"): "Agentic and SWE-Bench",
    ("benchmark_vs_production", "session_duration"): "Agentic and SWE-Bench",
    ("benchmark_vs_production", "input_per_request"): "Agentic and SWE-Bench",
}


def test_the_paper_counts_each_compared_item_in_the_scope_the_test_selects(paper_numbers: dict) -> None:
    for (section, item), scope in PAPER_SCOPES.items():
        assert paper_numbers[section][item]["scope"] == scope, f"{section}.{item}"


# `explore/headline_numbers` over `All` against `dataset.trace_summary`: `sessions`, `requests`, `tool_calls`,
# `input_tokens`, `output_tokens` and `cached_tokens`, each the column of the same name. The paper gives no accounts.
TRACE_SUMMARY_TOTALS = ["sessions", "requests", "tool_calls", "input_tokens", "output_tokens", "cached_tokens"]


def test_the_headline_totals_are_the_trace_summary(whole_trace: duckdb.DuckDBPyConnection,
                                                   paper_numbers: dict) -> None:
    totals = site_database.run_query(whole_trace, "explore/headline_numbers").iloc[0]
    assert_match(paper_numbers, [Comparison("dataset", "trace_summary", name, float(totals[name]), EXACT)
                                 for name in TRACE_SUMMARY_TOTALS])


def test_the_median_counts_per_session(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/requests_per_session_cdf`'s `x` at share 0.5 of the series `requests`, `user_steps` and `tool_steps`
    # against `sessions.counts_per_session.median_requests`, `.median_user_steps` and `.median_tool_steps`.
    rows = site_database.run_query(agentic, "figures/requests_per_session_cdf")
    assert_match(paper_numbers, [
        Comparison("sessions", "counts_per_session", f"median_{series}", cdf_point(rows, series, MEDIAN_SHARE),
                   RELATIVE_TOLERANCE)
        for series in ["requests", "user_steps", "tool_steps"]])


def test_the_median_tokens_per_request(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/tokens_per_request_cdf`'s `x` at share 0.5 of the series `input`, `uncached` and `output` against
    # `sessions.tokens_per_request.median_input`, `.median_uncached` and `.median_output`.
    rows = site_database.run_query(agentic, "figures/tokens_per_request_cdf")
    assert_match(paper_numbers, [
        Comparison("sessions", "tokens_per_request", f"median_{series}", cdf_point(rows, series, MEDIAN_SHARE),
                   RELATIVE_TOLERANCE)
        for series in ["input", "uncached", "output"]])


def test_the_turn_and_session_durations(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/duration_cdf`'s `x` against `sessions.turn_and_session_duration`: the series `turn` at share 0.5
    # against `turn_median_s`, and `session` at 0.5 and 0.9 against `session_median_s` and `session_p90_s`.
    rows = site_database.run_query(agentic, "figures/duration_cdf")
    item = "turn_and_session_duration"
    assert_match(paper_numbers, [
        Comparison("sessions", item, "turn_median_s", cdf_point(rows, "turn", MEDIAN_SHARE), RELATIVE_TOLERANCE),
        Comparison("sessions", item, "session_median_s", cdf_point(rows, "session", MEDIAN_SHARE),
                   RELATIVE_TOLERANCE),
        Comparison("sessions", item, "session_p90_s", cdf_point(rows, "session", NINETIETH_PERCENTILE_SHARE),
                   RELATIVE_TOLERANCE),
    ])


def test_the_median_trusted_ttft_of_the_paper_s_models(agentic: duckdb.DuckDBPyConnection,
                                                       paper_numbers: dict) -> None:
    # `figures/ttft_median_by_model`'s `median_ttft_s` of each model against
    # `sessions.ttft_decomposition_<model>.median_ttft_s`.
    medians = site_database.run_query(agentic, "figures/ttft_median_by_model").set_index("model").median_ttft_s
    assert_match(paper_numbers, [
        Comparison("sessions", f"ttft_decomposition_{model}", "median_ttft_s", float(medians[model]),
                   RELATIVE_TOLERANCE)
        for model in TTFT_MODELS])


def paper_tool_categories(paper_numbers: dict) -> list[str]:
    """The tool categories of the paper's tool overview: each `<category>_calls_percent` key but the `All` row's."""
    suffix = "_calls_percent"
    categories = []
    for name in paper_numbers["tools"]["tool_overview"]:
        if name.endswith(suffix) and name != f"All{suffix}":
            categories.append(name.removesuffix(suffix))
    return categories


def test_the_tool_overview(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # Per category, `figures/tool_overview`'s `share_of_calls` and `failed_share` (in percent) against
    # `tools.tool_overview.<category>_calls_percent` and `.<category>_fail_percent`, its `median_latency_ms` (in
    # seconds) against `tools.latency_by_category.<category>_median_latency_s`, and its `median_result_tokens`
    # against `tools.result_tokens_by_category.<category>_median_result_tokens`.
    overview = site_database.run_query(agentic, "figures/tool_overview").set_index("category")
    comparisons = []
    for category in paper_tool_categories(paper_numbers):
        row = overview.loc[category]
        comparisons += [
            Comparison("tools", "tool_overview", f"{category}_calls_percent", PERCENT * row.share_of_calls,
                       RELATIVE_TOLERANCE),
            Comparison("tools", "tool_overview", f"{category}_fail_percent", PERCENT * row.failed_share,
                       RELATIVE_TOLERANCE),
            Comparison("tools", "latency_by_category", f"{category}_median_latency_s",
                       row.median_latency_ms / MILLISECONDS_PER_SECOND, RELATIVE_TOLERANCE),
            Comparison("tools", "result_tokens_by_category", f"{category}_median_result_tokens",
                       row.median_result_tokens, RELATIVE_TOLERANCE),
        ]
    assert_match(paper_numbers, comparisons)


def test_the_tool_latency_and_result_size_ranges(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # Per category, `figures/latency_by_category`'s `p50` and `p95` (in seconds) against
    # `tools.latency_by_category.<category>_median_latency_s` and `.<category>_p95_latency_s`, and
    # `figures/result_tokens_by_category`'s `p50` against
    # `tools.result_tokens_by_category.<category>_median_result_tokens`.
    latency = site_database.run_query(agentic, "figures/latency_by_category").set_index("category")
    result_tokens = site_database.run_query(agentic, "figures/result_tokens_by_category").set_index("category")
    comparisons = []
    for category in paper_tool_categories(paper_numbers):
        comparisons += [
            Comparison("tools", "latency_by_category", f"{category}_median_latency_s",
                       latency.p50[category] / MILLISECONDS_PER_SECOND, RELATIVE_TOLERANCE),
            Comparison("tools", "latency_by_category", f"{category}_p95_latency_s",
                       latency.p95[category] / MILLISECONDS_PER_SECOND, RELATIVE_TOLERANCE),
            Comparison("tools", "result_tokens_by_category", f"{category}_median_result_tokens",
                       result_tokens.p50[category], RELATIVE_TOLERANCE),
        ]
    assert_match(paper_numbers, comparisons)


def test_dead_over_active_cache_at_a_day(agentic: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # `figures/dead_over_active_by_policy` at the TTL `1d`: `ttl_only`'s `dead_over_active` against
    # `prefix_caching.retained_over_active.dead_over_active_1d`, and `ttl_only`'s over `reclaim_both`'s (how far
    # reclaiming both lowers it) against `prefix_caching.dead_over_active_by_policy.reclaim_both_dead_fall_1d`.
    rows = site_database.run_query(agentic, "figures/dead_over_active_by_policy")
    at_a_day = rows[rows.ttl == LONGEST_TTL].set_index("policy").dead_over_active
    assert_match(paper_numbers, [
        Comparison("prefix_caching", "retained_over_active", "dead_over_active_1d", at_a_day["ttl_only"],
                   RELATIVE_TOLERANCE),
        Comparison("prefix_caching", "dead_over_active_by_policy", "reclaim_both_dead_fall_1d",
                   at_a_day["ttl_only"] / at_a_day["reclaim_both"], RELATIVE_TOLERANCE),
    ])


def test_the_benchmark_s_medians(benchmark: duckdb.DuckDBPyConnection, paper_numbers: dict) -> None:
    # Over `SWE-Bench`, the `x` at share 0.5 of `figures/duration_cdf`'s `turn` and `session` against
    # `benchmark_vs_production.turn_duration.median_benchmark` and `.session_duration.median_benchmark`, and of
    # `figures/tokens_per_request_cdf`'s `input` against `benchmark_vs_production.input_per_request.median_benchmark`.
    durations = site_database.run_query(benchmark, "figures/duration_cdf")
    tokens = site_database.run_query(benchmark, "figures/tokens_per_request_cdf")
    section = "benchmark_vs_production"
    assert_match(paper_numbers, [
        Comparison(section, "turn_duration", "median_benchmark", cdf_point(durations, "turn", MEDIAN_SHARE),
                   RELATIVE_TOLERANCE),
        Comparison(section, "session_duration", "median_benchmark", cdf_point(durations, "session", MEDIAN_SHARE),
                   RELATIVE_TOLERANCE),
        Comparison(section, "input_per_request", "median_benchmark", cdf_point(tokens, "input", MEDIAN_SHARE),
                   RELATIVE_TOLERANCE),
    ])
