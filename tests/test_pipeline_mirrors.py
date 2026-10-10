"""The pipeline constants the browser holds a copy of, to draw, still equal the pipeline's own: each test parses
the constant out of the JavaScript or SQL text and compares it with the value the pipeline names."""

import math
import pathlib
import re

from paper.metrics import gaps, tools
from release import population, schema
from simulation import cache

import site_database

SITE_FOLDER = pathlib.Path(__file__).resolve().parent.parent / "site"
CACHING_MODULE = SITE_FOLDER / "js" / "figures" / "caching.js"  # the idle-gap bins, the TTLs and the policies
TIMELINE_BARS_MODULE = SITE_FOLDER / "js" / "session" / "timeline_bars.js"  # the wait causes
SELECTION_MODULE = SITE_FOLDER / "js" / "shared" / "selection.js"  # the scopes and the release scopes each holds
TOOL_OVERVIEW_QUERY = SITE_FOLDER / "queries" / "figures" / "tool_overview.sql"  # the failed outcomes
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


def test_the_ttls_are_the_simulation_s_in_its_order() -> None:
    body = declaration(CACHING_MODULE, r"const TTLS = Object\.freeze\(\[(.*?)\]\);").group(1)
    pipeline_labels = [label for label, _seconds in cache.TTLS]
    assert re.findall(r'"([^"]+)"', body) == pipeline_labels


def test_the_policies_are_the_simulation_s_in_its_order() -> None:
    assert javascript_object_keys(CACHING_MODULE, "POLICY_NAMES") == list(cache.POLICIES)


def test_the_wait_causes_are_the_release_s_waited_for_values() -> None:
    assert sorted(javascript_object_keys(TIMELINE_BARS_MODULE, "WAIT_CAUSES")) == sorted(schema.WAITED_FOR)


def browser_scope_members() -> dict[str, list[str]]:
    """The object `SCOPE_MEMBERS` of selection.js: each scope the visitor picks, with the release scopes it holds."""
    body = declaration(SELECTION_MODULE, r"const SCOPE_MEMBERS = Object\.freeze\(\{(.*?)\}\);").group(1)
    members = {}
    for scope, listed in re.findall(r'"?([\w-]+)"?\s*:\s*\[(.*?)\]', body):
        members[scope] = re.findall(r'"([^"]+)"', listed)
    return members


def pipeline_scope_members() -> dict[str, list[str]]:
    """Each scope the pipeline names, with the scopes of the sessions it selects."""
    return {
        population.AGENTIC: [population.AGENTIC],
        population.SWE_BENCH: [population.SWE_BENCH],
        population.ALL_SCOPES: [population.AGENTIC, population.SWE_BENCH],
    }


def test_the_browser_s_scopes_are_the_pipeline_s() -> None:
    assert browser_scope_members() == pipeline_scope_members()


def test_the_test_database_s_scopes_are_the_pipeline_s() -> None:
    assert site_database.SCOPES_OF == pipeline_scope_members()


def test_the_failed_outcomes_are_the_pipeline_s() -> None:
    listed = declaration(TOOL_OVERVIEW_QUERY, r"outcome IN \(([^)]*)\)").group(1)
    assert sorted(re.findall(r"'([^']+)'", listed)) == sorted(tools.FAILED_OUTCOMES)
