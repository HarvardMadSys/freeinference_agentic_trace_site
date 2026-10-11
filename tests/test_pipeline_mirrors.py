"""The pipeline constants the browser holds a copy of, to draw, still equal the pipeline's own: each test parses
the constant out of the JavaScript or SQL text, or reads it from the data step's output on the fixture, and compares
it with the value the pipeline names."""

import json
import math
import pathlib
import re

import pytest

from paper.metrics import binning, gaps, latency, prices
from release import population, schema

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
CACHING_MODULE = SITE_FOLDER / "js" / "figures" / "caching.js"  # the idle-gap bins
TIMELINE_BARS_MODULE = SITE_FOLDER / "js" / "session_charts" / "timeline_bars.js"  # the wait causes
FIGURE_QUERIES = SITE_FOLDER / "queries" / "figures"  # the figure queries
COST_SHARE_QUERY = FIGURE_QUERIES / "cost_share_by_session.sql"  # the prices
SESSION_TIME_QUERY = FIGURE_QUERIES / "session_time_by_part.sql"  # which waits are tool time and which a person's
RANK_BIN_QUERIES = [COST_SHARE_QUERY, SESSION_TIME_QUERY]  # each cuts sessions into the pipeline's rank bins
EDGE_TOLERANCE = 1e-9  # relative; the browser computes the geometric edges itself, so they agree only to rounding


def declaration(path: pathlib.Path, pattern: str) -> re.Match:
    """The first match of `pattern` in the text of `path`; the test fails when there is none."""
    found = re.search(pattern, path.read_text(), re.DOTALL)
    assert found is not None, f"{path.name} has no match for {pattern}"
    return found


def javascript_number(path: pathlib.Path, constant: str) -> float:
    """The value of `const <constant> = <number>;` in the module at `path`."""
    return float(declaration(path, rf"const {constant} = ([\d.]+);").group(1))


def javascript_object_keys(path: pathlib.Path, constant: str) -> list[str]:
    """The keys, in order, of `const <constant> = Object.freeze({ key: …, … });`, quoted or not."""
    body = declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return re.findall(r'^\s*"?([\w-]+)"?\s*:', body, re.MULTILINE)


def sql_number(path: pathlib.Path, column: str) -> float:
    """The value of the literal `<number> AS <column>` in the query at `path`."""
    return float(declaration(path, rf"([\d.]+) AS {column}\b").group(1))


def sql_strings(path: pathlib.Path, column: str) -> list[str]:
    """The quoted strings, in order, of the literal list `[...] AS <column>` in the query at `path`."""
    return re.findall(r"'([^']+)'", declaration(path, rf"\[([^\]]*)\] AS {column}\b").group(1))


def browser_idle_gap_edges() -> list[float]:
    """The idle-gap edges caching.js draws: `IDLE_GAP_BINS + 1` geometric edges from the first to the last edge."""
    first = javascript_number(CACHING_MODULE, "FIRST_IDLE_GAP_EDGE_S")
    last = javascript_number(CACHING_MODULE, "LAST_IDLE_GAP_EDGE_S")
    bins = int(javascript_number(CACHING_MODULE, "IDLE_GAP_BINS"))
    edges = []
    for edge in range(bins + 1):
        edges.append(first * (last / first) ** (edge / bins))
    return edges


def test_the_idle_gap_edges_are_the_pipeline_s() -> None:
    browser_edges = browser_idle_gap_edges()
    assert len(browser_edges) == len(gaps.IDLE_GAP_EDGES_S)
    for browser_edge, pipeline_edge in zip(browser_edges, gaps.IDLE_GAP_EDGES_S):
        assert math.isclose(browser_edge, pipeline_edge, rel_tol=EDGE_TOLERANCE)


def test_the_wait_causes_are_the_release_s_waited_for_values() -> None:
    assert sorted(javascript_object_keys(TIMELINE_BARS_MODULE, "WAIT_CAUSES")) == sorted(schema.WAITED_FOR)


def test_the_benchmark_harness_of_the_harness_index_is_the_pipeline_s(data_directory: pathlib.Path) -> None:
    listed = json.loads((data_directory / "harnesses.json").read_text())
    assert [entry["harness"] for entry in listed if entry["benchmark"]] == [population.BENCHMARK_HARNESS]


def test_no_harness_name_holds_a_comma(data_directory: pathlib.Path) -> None:
    # The URL key `harnesses` joins the selected harnesses' names with commas, so a name with one would be split.
    listed = json.loads((data_directory / "harnesses.json").read_text())
    for name in [population.BENCHMARK_HARNESS, *[entry["harness"] for entry in listed]]:
        assert "," not in name, name


def test_the_cost_share_prices_are_the_pipeline_s() -> None:
    assert sql_number(COST_SHARE_QUERY, "cached_price") == prices.CACHED_PRICE
    assert sql_number(COST_SHARE_QUERY, "uncached_price") == prices.UNCACHED_PRICE
    assert sql_number(COST_SHARE_QUERY, "output_price") == prices.OUTPUT_PRICE


@pytest.mark.parametrize("path", RANK_BIN_QUERIES, ids=lambda path: path.stem)
def test_the_rank_bins_are_the_pipeline_s(path: pathlib.Path) -> None:
    assert sql_number(path, "max_rank_bins") == binning.MAX_RANK_BINS
    assert sql_number(path, "sessions_per_rank_bin") == binning.SESSIONS_PER_RANK_BIN


def test_the_session_time_s_waits_are_the_pipeline_s() -> None:
    assert sql_strings(SESSION_TIME_QUERY, "tool_waits") == list(latency.TOOL_WAITS)
    assert sql_strings(SESSION_TIME_QUERY, "human_waits") == list(latency.HUMAN_WAITS)
