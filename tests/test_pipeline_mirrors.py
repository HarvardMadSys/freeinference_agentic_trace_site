"""The pipeline constants the browser holds a copy of, to draw, still equal the pipeline's own: each test parses
the constant out of the JavaScript or SQL text, or reads it from the data step's output on the fixture, and compares
it with the value the pipeline names."""

import json
import math
import pathlib
import re

import pytest

import paper.benchmark_vs_production.comparison
import paper.sessions.latency
from paper.metrics import binning, gaps, latency, prices, tools, trajectories
from release import population, schema

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
CACHING_MODULE = SITE_FOLDER / "js" / "figures" / "caching.js"  # the idle-gap bins
TIMELINE_BARS_MODULE = SITE_FOLDER / "js" / "session_charts" / "timeline_bars.js"  # the wait causes
FIGURE_QUERIES = SITE_FOLDER / "queries" / "figures"  # the figure queries
COST_SHARE_QUERY = FIGURE_QUERIES / "cost_share_by_session.sql"  # the prices
SESSION_TIME_QUERY = FIGURE_QUERIES / "session_time_by_part.sql"  # the rank bins
RANK_BIN_QUERIES = [COST_SHARE_QUERY, SESSION_TIME_QUERY]  # each cuts sessions into the pipeline's rank bins
SPEEDUP_QUERY = FIGURE_QUERIES / "speedup_if_twice_as_fast.sql"
# The one home of a session's time breakdown, which waits are tool time and which a person's, and the tool wait cap.
SESSION_TIME_VIEW = SITE_FOLDER / "queries" / "setup" / "create_view_session_time.sql"
TIME_QUERIES = [SESSION_TIME_QUERY, SPEEDUP_QUERY]  # each reads the breakdown from the view, restating none of it
TIME_CONSTANTS = ["tool_waits", "user_waits", "tool_gap_cap_s"]  # the view's copies of the pipeline's constants
LATENCY_MODULE = SITE_FOLDER / "js" / "figures" / "latency.js"  # the speed-up axis's headroom
TOOL_MIX_QUERY = FIGURE_QUERIES / "tool_mix_by_turn_position.sql"  # the tenths, the tool groups and the program sets
COLOURS_MODULE = SITE_FOLDER / "js" / "theme" / "colours.js"  # the tool groups, their colours and categories
TOOL_MIX_MODULE = SITE_FOLDER / "js" / "comparison" / "tool_mix.js"  # the tenths
SCOPE_CDFS_MODULE = SITE_FOLDER / "js" / "comparison" / "scope_cdfs.js"  # where each scope CDF's axis starts
SCOPES_MODULE = SITE_FOLDER / "js" / "comparison" / "scopes.js"  # the scopes' names and labels
# The queries that name each row's scope by its harness: the comparison figures' and the prefill figure's.
SCOPE_QUERIES = [FIGURE_QUERIES / f"{name}.sql" for name in [
    "turn_duration_by_scope", "session_duration_by_scope", "input_per_request_by_scope", "user_prompt_tokens_by_scope",
    "tool_mix_by_turn_position", "prefill_against_storage"]]
SCOPE_CASE = re.compile(r"THEN '([\w-]+)' ELSE '([\w-]+)' END AS (?:scope|series)")  # benchmark's name, then the rest's
CALLS_PER_REQUEST_QUERY = FIGURE_QUERIES / "calls_per_request_by_category.sql"  # the category left out
BATCH_WIDTH_QUERY = FIGURE_QUERIES / "latency_by_batch_width.sql"  # what a tool wait is, the widths and quantiles
BATCHING_MODULE = SITE_FOLDER / "js" / "figures" / "tools_batching.js"  # the widest width drawn on its own
EDGE_TOLERANCE = 1e-9  # relative; the browser computes the geometric edges itself, so they agree only to rounding
# The figure queries that restate a pipeline definition in SQL, each with its figure's title. Each is read by a mirror
# test, and CONTRIBUTING.md lists them.
RESTATING_QUERIES = {
    "cost_share_by_session": "Cost breakdown by session",
    "session_time_by_part": "Where session time goes",
    "speedup_if_twice_as_fast": "Speedup by component",
    "calls_per_request_by_category": "Calls per request by category",
    "latency_by_batch_width": "Tool latency by batch width",
    "tool_mix_by_turn_position": "Tool mix along a turn",
    "mutations_by_cause": "Context mutations by cause",
    "prefill_against_storage": "Input processing versus cache storage",
    "api_cost_by_ttl": "API cost by cache retention time",
    "infrastructure_cost_by_ttl": "Serving cost by cache retention time",
}
MIRROR_TESTS = sorted(pathlib.Path(__file__).resolve().parent.glob("test_pipeline_mirrors*.py"))  # read the copies
# The folders of every figure entry: the first three sections', the cache simulation's and the comparison section's.
FIGURE_FOLDERS = [SITE_FOLDER / "js" / folder for folder in ("figures", "simulation", "comparison")]


def declaration(path: pathlib.Path, pattern: str) -> re.Match:
    """The first match of `pattern` in the text of `path`; the test fails when there is none."""
    found = re.search(pattern, path.read_text(), re.DOTALL)
    assert found is not None, f"{path.name} has no match for {pattern}"
    return found


def javascript_number(path: pathlib.Path, constant: str) -> float:
    """The value of `const <constant> = <number>;` in the module at `path`."""
    return float(declaration(path, rf"const {constant} = ([\d.]+);").group(1))


def javascript_object_keys(path: pathlib.Path, constant: str) -> list[str]:
    """The keys, in order, of `const <constant> = Object.freeze({ key: …, … });`, quoted or not, one or more a line."""
    body = declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return re.findall(r'(?:^|,)\s*"?([\w-]+)"?\s*:', body, re.MULTILINE)


def sql_number(path: pathlib.Path, column: str) -> float:
    """The value of the literal `<number> AS <column>` in the query at `path`."""
    return float(declaration(path, rf"([\d.]+) AS {column}\b").group(1))


def sql_strings(path: pathlib.Path, column: str) -> list[str]:
    """The quoted strings, in order, of the literal list `[...] AS <column>` in the query at `path`."""
    return re.findall(r"'([^']+)'", declaration(path, rf"\[([^\]]*)\] AS {column}\b").group(1))


def sql_string(path: pathlib.Path, column: str) -> str:
    """The value of the literal `'<text>' AS <column>` in the query at `path`."""
    return declaration(path, rf"'([^']+)' AS {column}\b").group(1)


def sql_pairs(path: pathlib.Path, table: str) -> dict[str, str]:
    """The rows of the literal table `<table> (…) AS (VALUES ('<key>', '<value>'), …)` in the query at `path`."""
    body = declaration(path, rf"{table} \([^)]*\) AS \(\s*VALUES(.*?)\n\)").group(1)
    return dict(re.findall(r"\('([^']+)', '([^']+)'\)", body))


def javascript_object_values(path: pathlib.Path, constant: str) -> list[str]:
    """The quoted values, in order, of `const <constant> = Object.freeze({ key: "value", … });`."""
    body = declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return re.findall(r':\s*"([^"]+)"', body)


def javascript_quoted_keys(path: pathlib.Path, constant: str) -> list[str]:
    """The quoted keys, in order, of `const <constant> = Object.freeze({ "key": …, … });`."""
    body = declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return re.findall(r'^\s*"([^"]+)"\s*:', body, re.MULTILINE)


def javascript_quoted_pairs(path: pathlib.Path, constant: str) -> dict[str, str]:
    """The entries of `const <constant> = Object.freeze({ "key": "value", … });`, keys and values quoted."""
    body = declaration(path, rf"const {constant} = Object\.freeze\(\{{(.*?)\}}\);").group(1)
    return dict(re.findall(r'^\s*"([^"]+)"\s*:\s*"([^"]+)"', body, re.MULTILINE))


def sql_percentile_columns(path: pathlib.Path, column: str) -> list[float]:
    """The quantiles, in order, of the columns `quantile_cont(<…>.<column>, <number>) AS p<percent>` in the query at
    `path`."""
    pattern = rf"quantile_cont\([\w.]*\b{column}, ([\d.]+)\) AS p\d+\b"
    return [float(number) for number in re.findall(pattern, path.read_text())]


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


def test_the_session_time_s_waits_and_tool_wait_cap_are_the_pipeline_s() -> None:
    assert sql_strings(SESSION_TIME_VIEW, "tool_waits") == list(latency.TOOL_WAITS)
    assert sql_strings(SESSION_TIME_VIEW, "user_waits") == list(latency.HUMAN_WAITS)
    assert sql_number(SESSION_TIME_VIEW, "tool_gap_cap_s") == latency.TOOL_GAP_CAP_S


@pytest.mark.parametrize("path", TIME_QUERIES, ids=lambda path: path.stem)
def test_a_time_figure_reads_the_one_breakdown_and_restates_none_of_it(path: pathlib.Path) -> None:
    text = path.read_text()
    assert "FROM session_time" in text
    assert "FROM requests" not in text
    for constant in TIME_CONSTANTS:
        assert constant not in text, constant


def test_the_speedup_s_axis_headroom_is_the_pipeline_s() -> None:
    assert javascript_number(LATENCY_MODULE, "SPEEDUP_AXIS_HEADROOM") == \
        paper.sessions.latency.SPEEDUP_AXIS_HEADROOM


def test_the_tool_mix_s_tenths_are_the_pipeline_s() -> None:
    assert sql_number(TOOL_MIX_QUERY, "tenths") == trajectories.BINS
    assert javascript_number(TOOL_MIX_MODULE, "TENTHS") == trajectories.BINS


def test_the_tool_mix_s_group_rule_is_the_pipeline_s() -> None:
    assert sql_string(TOOL_MIX_QUERY, "file_ops_category") == trajectories.FILE_OPS
    assert sql_pairs(TOOL_MIX_QUERY, "group_of_category") == trajectories.GROUP_OF_CATEGORY
    assert set(sql_strings(TOOL_MIX_QUERY, "reading_programs")) == trajectories.READING_PROGRAMS
    assert set(sql_strings(TOOL_MIX_QUERY, "writing_programs")) == trajectories.WRITING_PROGRAMS


def test_the_tool_groups_coloured_are_the_pipeline_s_in_its_order() -> None:
    assert javascript_quoted_keys(COLOURS_MODULE, "TOOL_GROUP_COLOURS") == list(trajectories.GROUPS)


def test_the_group_each_tool_category_is_coloured_by_is_the_pipeline_s() -> None:
    assert javascript_quoted_pairs(COLOURS_MODULE, "TOOL_GROUP_OF_CATEGORY") == trajectories.GROUP_OF_CATEGORY


@pytest.mark.parametrize("path", [CALLS_PER_REQUEST_QUERY, BATCH_WIDTH_QUERY], ids=lambda path: path.stem)
def test_the_batching_figures_leave_out_the_pipeline_s_ask_user_category(path: pathlib.Path) -> None:
    assert sql_string(path, "ask_user_category") == schema.ASK_USER_CATEGORY


def test_the_batch_width_s_tool_wait_widths_and_quantiles_are_the_pipeline_s() -> None:
    assert sql_strings(BATCH_WIDTH_QUERY, "tool_waited_for") == list(tools.TOOL_WAITED_FOR)
    assert sql_number(BATCH_WIDTH_QUERY, "widest_drawn") == tools.WIDEST_DRAWN
    assert javascript_number(BATCHING_MODULE, "WIDEST_DRAWN") == tools.WIDEST_DRAWN
    assert sql_percentile_columns(BATCH_WIDTH_QUERY, "tool_wait_s") == list(tools.BAND_QUANTILES)


def test_the_scope_cdfs_floors_are_the_pipeline_s() -> None:
    comparison = paper.benchmark_vs_production.comparison
    assert javascript_number(SCOPE_CDFS_MODULE, "MIN_DURATION_DRAWN_S") == comparison.MIN_DURATION_DRAWN_S
    assert javascript_number(SCOPE_CDFS_MODULE, "MIN_INPUT_DRAWN") == comparison.MIN_INPUT_DRAWN
    assert javascript_number(SCOPE_CDFS_MODULE, "MIN_PROMPT_DRAWN") == comparison.MIN_PROMPT_DRAWN


def test_the_scopes_are_the_pipeline_s_names_and_labels() -> None:
    labels = paper.benchmark_vs_production.comparison.SCOPE_LABELS
    assert javascript_object_keys(SCOPES_MODULE, "SCOPE_LABELS") == [population.AGENTIC, population.SWE_BENCH]
    assert javascript_object_values(SCOPES_MODULE, "SCOPE_LABELS") == list(labels.values())


@pytest.mark.parametrize("path", SCOPE_QUERIES, ids=lambda path: path.stem)
def test_a_query_names_each_scope_as_the_pipeline_does(path: pathlib.Path) -> None:
    # A request of the benchmark's harness is the benchmark replay's, any other the paper's harnesses'.
    assert SCOPE_CASE.findall(path.read_text()) == [(population.SWE_BENCH, population.AGENTIC)]


@pytest.mark.parametrize("query", RESTATING_QUERIES)
def test_a_mirror_test_reads_each_restating_query(query: str) -> None:
    mirror_text = "".join(path.read_text() for path in MIRROR_TESTS)
    assert f"{query}.sql" in mirror_text


@pytest.mark.parametrize("query", RESTATING_QUERIES)
def test_each_restating_query_draws_the_figure_named_for_it(query: str) -> None:
    entries = "".join(path.read_text() for folder in FIGURE_FOLDERS for path in folder.glob("*.js"))
    # From the title to the query within one entry: the match may not pass the next entry's title.
    entry = rf'title: "{re.escape(RESTATING_QUERIES[query])}",(?:(?!title: ).)*?query: "figures/{query}"'
    assert re.search(entry, entries, re.DOTALL)
