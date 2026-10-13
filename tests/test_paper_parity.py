"""The site's figures give the paper's numbers: every number a figure shares with the paper's `numbers.json` is equal.

The numbers are read from the shipped answers, `site/data/all_weeks/<query>.json`, which `make data` wrote with every
week and the harnesses of the paper's scope selected: every harness for `All` (the trace totals), every harness but the
benchmark's for `Agentic` (every figure). It is skipped when the shipped answers or `numbers.json` in
`$FREEINFERENCE_PIPELINE` (by default the sibling pipeline repository the Makefile builds from) is missing. The
fixture `paper_numbers`, which other parity modules share, is in `conftest.py`.

A number counted the same way is compared; a count must be equal and a median, share or ratio equal up to
`RELATIVE_TOLERANCE`. These figures draw a number the paper also reports, but define it differently on purpose, so
they are not compared:

- `token_split_by_week` shows plain token shares, where the paper's cost split weights tokens by price;
- `context_share_by_role` takes each role's share of the pooled tokens per message bin, where the paper takes it per
  request and bins the requests;
- `ttft_cdf_by_model` draws the five models with most requests, where the paper draws two chosen models (their
  medians are compared through `ttft_median_by_model` instead);
- `hit_ratio_by_idle_gap` bins idle gaps by fixed edges and hides thin bins, where the paper merges a thin bin into
  the next, so its per-provider medians at the longest gap fall in other bins.
"""

import json
import math
import os
import pathlib
import typing

import pandas
import pytest

import site_database

ANSWERS_FOLDER = site_database.QUERIES_FOLDER.parent / "data" / "all_weeks"  # written by `make data`, tracked
PIPELINE_VARIABLE = "FREEINFERENCE_PIPELINE"  # names the pipeline repository's folder, when it is not the default
# Unset, it is `../freeinference-agentic-pipeline` from this repository's root, the Makefile's `PIPELINE` default.
DEFAULT_PIPELINE_FOLDER = site_database.QUERIES_FOLDER.parent.parent / ".." / "freeinference-agentic-pipeline"
NUMBERS_PATH = pathlib.Path("figures") / "v1" / "numbers.json"  # where the pipeline writes the paper's numbers
RELEASE_PATH = pathlib.Path("data") / "v1" / "release"  # where the pipeline writes the release, the Makefile's `RELEASE`

EXACT = 0  # a count matches only when it is equal
RELATIVE_TOLERANCE = 1e-6  # a median, share or ratio may differ by DuckDB's and numpy's float rounding, no more
MEDIAN_SHARE = 0.5  # the CDF point whose `x` is the median
NINETIETH_PERCENTILE_SHARE = 0.9  # the CDF point whose `x` is the 90th percentile
MILLISECONDS_PER_SECOND = 1000  # the site's latencies are in milliseconds, the paper's in seconds
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


def pipeline_folder() -> pathlib.Path:
    """The pipeline folder `$FREEINFERENCE_PIPELINE`, or the default one."""
    return pathlib.Path(os.environ.get(PIPELINE_VARIABLE, str(DEFAULT_PIPELINE_FOLDER)))


def numbers_file() -> pathlib.Path:
    """The paper's `numbers.json` in the pipeline folder."""
    return pipeline_folder() / NUMBERS_PATH


def release_folder() -> pathlib.Path:
    """The release folder in the pipeline folder, one folder per week."""
    return pipeline_folder() / RELEASE_PATH


def skip_unless_inputs_exist() -> None:
    """Skip the calling test when the shipped answers or `numbers.json` is missing, naming it."""
    for path in [ANSWERS_FOLDER, numbers_file()]:
        if not path.exists():
            pytest.skip(f"the paper-parity test needs {path}, which is missing")


def answer(name: str) -> pandas.DataFrame:
    """The shipped answer of the query `name`, `<folder>/<query>`, as a frame with the query's columns."""
    return pandas.DataFrame(json.loads((ANSWERS_FOLDER / f"{name}.json").read_text()))


def cdf_point(rows: pandas.DataFrame, series: str, share: float) -> float:
    """The `x` of a CDF query's series at `share`."""
    point = rows[(rows.series == series) & (rows.share == share)]
    assert len(point) == 1, f"{series} has {len(point)} points at share {share}"
    return float(point.x.iloc[0])


# The scope `numbers.json` records with each compared item, by section and item: the answers were written over its
# harnesses.
PAPER_SCOPES = {
    ("dataset", "trace_summary"): "All",
    ("sessions", "counts_per_session"): "Agentic",
    ("sessions", "tokens_per_request"): "Agentic",
    ("sessions", "turn_and_session_duration"): "Agentic",
    ("sessions", "ttft_decomposition_minimax-m2.7"): "Agentic",
    ("sessions", "ttft_decomposition_kimi-k2.7-code"): "Agentic",
    ("tools", "latency_by_category"): "Agentic",
    ("tools", "result_tokens_by_category"): "Agentic",
    ("tools", "latency_by_batch_width"): "Agentic",
    ("tools", "calls_per_request_by_category"): "Agentic",
}


def test_the_paper_counts_each_compared_item_in_the_scope_the_test_selects(paper_numbers: dict) -> None:
    for (section, item), scope in PAPER_SCOPES.items():
        assert paper_numbers[section][item]["scope"] == scope, f"{section}.{item}"


# `explore/trace_totals` over `All` against `dataset.trace_summary`: `sessions`, `requests`, `tool_calls`,
# `input_tokens`, `output_tokens` and `cached_tokens`, each the column of the same name, and the paper's `harnesses`,
# which leaves the benchmark's out, the answer's harnesses less its benchmark harnesses. The paper gives no accounts.
TRACE_SUMMARY_TOTALS = ["sessions", "requests", "tool_calls", "input_tokens", "output_tokens", "cached_tokens"]


def test_the_trace_totals_are_the_trace_summary(paper_numbers: dict) -> None:
    totals = answer("explore/trace_totals").iloc[0]
    comparisons = [Comparison("dataset", "trace_summary", name, float(totals[name]), EXACT)
                   for name in TRACE_SUMMARY_TOTALS]
    human_driven_harnesses = float(totals["harnesses"] - totals["benchmark_harnesses"])
    comparisons.append(Comparison("dataset", "trace_summary", "harnesses", human_driven_harnesses, EXACT))
    assert_match(paper_numbers, comparisons)


def test_the_median_counts_per_session(paper_numbers: dict) -> None:
    # `figures/requests_per_session_cdf`'s `x` at share 0.5 of the series `requests`, `user_steps` and `tool_steps`
    # against `sessions.counts_per_session.median_requests`, `.median_user_steps` and `.median_tool_steps`.
    rows = answer("figures/requests_per_session_cdf")
    assert_match(paper_numbers, [
        Comparison("sessions", "counts_per_session", f"median_{series}", cdf_point(rows, series, MEDIAN_SHARE),
                   RELATIVE_TOLERANCE)
        for series in ["requests", "user_steps", "tool_steps"]])


def test_the_median_tokens_per_request(paper_numbers: dict) -> None:
    # `figures/tokens_per_request_cdf`'s `x` at share 0.5 of the series `input`, `uncached` and `output` against
    # `sessions.tokens_per_request.median_input`, `.median_uncached` and `.median_output`.
    rows = answer("figures/tokens_per_request_cdf")
    assert_match(paper_numbers, [
        Comparison("sessions", "tokens_per_request", f"median_{series}", cdf_point(rows, series, MEDIAN_SHARE),
                   RELATIVE_TOLERANCE)
        for series in ["input", "uncached", "output"]])


def test_the_turn_and_session_durations(paper_numbers: dict) -> None:
    # `figures/duration_cdf`'s `x` against `sessions.turn_and_session_duration`: the series `turn` at share 0.5
    # against `turn_median_s`, and `session` at 0.5 and 0.9 against `session_median_s` and `session_p90_s`.
    rows = answer("figures/duration_cdf")
    item = "turn_and_session_duration"
    assert_match(paper_numbers, [
        Comparison("sessions", item, "turn_median_s", cdf_point(rows, "turn", MEDIAN_SHARE), RELATIVE_TOLERANCE),
        Comparison("sessions", item, "session_median_s", cdf_point(rows, "session", MEDIAN_SHARE),
                   RELATIVE_TOLERANCE),
        Comparison("sessions", item, "session_p90_s", cdf_point(rows, "session", NINETIETH_PERCENTILE_SHARE),
                   RELATIVE_TOLERANCE),
    ])


def test_the_median_trusted_ttft_of_the_paper_s_models(paper_numbers: dict) -> None:
    # `figures/ttft_median_by_model`'s `median_ttft_s` of each model against
    # `sessions.ttft_decomposition_<model>.median_ttft_s`.
    medians = answer("figures/ttft_median_by_model").set_index("model").median_ttft_s
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
    assert categories, "numbers.json names no tool category"
    return categories


def test_the_tool_latency_and_result_size_ranges(paper_numbers: dict) -> None:
    # Per category, `figures/latency_by_category`'s `p50` and `p95` (in seconds) against
    # `tools.latency_by_category.<category>_median_latency_s` and `.<category>_p95_latency_s`, and
    # `figures/result_tokens_by_category`'s `p50` against
    # `tools.result_tokens_by_category.<category>_median_result_tokens`.
    latency = answer("figures/latency_by_category").set_index("category")
    result_tokens = answer("figures/result_tokens_by_category").set_index("category")
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


def test_the_tool_wait_by_batch_width(paper_numbers: dict) -> None:
    # `figures/latency_by_batch_width`'s `rows` per width against `tools.latency_by_batch_width.requests_per_width`,
    # and the lowest and highest `p90` of the widths over one against `.batched_p90_s_lowest` and
    # `.batched_p90_s_highest`.
    widths = answer("figures/latency_by_batch_width")
    paper = paper_numbers["tools"]["latency_by_batch_width"]
    assert dict(zip(widths.width.astype(str), widths.rows)) == paper["requests_per_width"]
    batched = widths[widths.width > 1]
    assert_match(paper_numbers, [
        Comparison("tools", "latency_by_batch_width", "batched_p90_s_lowest", batched.p90.min(), RELATIVE_TOLERANCE),
        Comparison("tools", "latency_by_batch_width", "batched_p90_s_highest", batched.p90.max(), RELATIVE_TOLERANCE),
    ])


def test_the_calls_per_request_by_category(paper_numbers: dict) -> None:
    # `figures/calls_per_request_by_category`'s `mean_calls` per category, in its order, against
    # `tools.calls_per_request_by_category.mean_calls_per_request`, which lists the categories most calls first.
    rows = answer("figures/calls_per_request_by_category")
    paper = paper_numbers["tools"]["calls_per_request_by_category"]["mean_calls_per_request"]
    assert rows.category.tolist() == list(paper)
    assert rows.mean_calls.tolist() == pytest.approx(list(paper.values()), rel=RELATIVE_TOLERANCE)
