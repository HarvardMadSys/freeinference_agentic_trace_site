"""Every query of the site, run as the browser runs it on data built from the fixture release, returns its columns."""

import re

import duckdb
import pytest

import fixture_release
import site_database

# The columns of a distribution card's two queries: its bins, and its count, maximum and percentiles.
BIN_COLUMNS = ["bin_start", "bin_end", "rows"]
STATS_COLUMNS = ["count", "max", "p50", "p75", "p90", "p95"]

# The columns each query returns, in order, by the query's name. Every query file outside `setup/` has an entry.
EXPECTED_COLUMNS = {
    "explore/cached_fraction_bins": BIN_COLUMNS,
    "explore/cached_fraction_stats": STATS_COLUMNS,
    "explore/input_tokens_bins": BIN_COLUMNS,
    "explore/input_tokens_stats": STATS_COLUMNS,
    "explore/output_tokens_bins": BIN_COLUMNS,
    "explore/output_tokens_stats": STATS_COLUMNS,
    "explore/requests_per_session_bins": BIN_COLUMNS,
    "explore/requests_per_session_stats": STATS_COLUMNS,
    "explore/session_duration_bins": BIN_COLUMNS,
    "explore/session_duration_stats": STATS_COLUMNS,
    "explore/subagents_per_session_bins": BIN_COLUMNS,
    "explore/subagents_per_session_stats": STATS_COLUMNS,
    "explore/turns_per_session_bins": BIN_COLUMNS,
    "explore/turns_per_session_stats": STATS_COLUMNS,
    "explore/uncached_tokens_bins": BIN_COLUMNS,
    "explore/uncached_tokens_stats": STATS_COLUMNS,
    "explore/headline_numbers": ["sessions", "accounts", "requests", "input_tokens", "output_tokens", "tool_calls",
                                 "subagents", "reported_input_tokens", "cached_tokens"],
    "explore/input_tokens_per_week": ["week", "requests", "cached_tokens", "uncached_tokens", "unreported_tokens"],
    "explore/model_mix": ["model", "requests"],
    "explore/request_count": ["requests"],
    "explore/sessions_per_week_by_harness": ["week", "harness", "sessions"],
    "explore/sessions_of_selection": ["week", "session_id", "first_start_ms", "harness", "main_model", "requests",
                                      "turns", "subagents", "tool_calls", "duration_s", "input_tokens",
                                      "reported_input_tokens", "cached_tokens", "peak_prompt_tokens"],
    "figures/requests_per_session_cdf": ["series", "x", "share", "rows"],
    "figures/duration_cdf": ["series", "x", "share", "rows"],
    "figures/tokens_per_request_cdf": ["series", "x", "share", "rows"],
    "figures/token_split_by_week": ["week", "part", "share", "rows"],
    "figures/token_growth_by_messages": ["bin_start", "rows", "median_cached_tokens", "median_uncached_tokens",
                                         "median_output_tokens"],
    "figures/context_share_by_role": ["bin_start", "role", "share", "rows"],
    "figures/ttft_cdf_by_model": ["series", "x", "share", "rows"],
    "session/session_root": ["root_session_id", "week"],
    "session/session_tree": [
        "session_id", "parent_session_id", "spawned_by_step", "depth", "harness", "scope", "main_model", "user_id",
        "requests", "user_steps", "tool_calls", "first_start_ms", "duration_s", "input_tokens",
        "reported_input_tokens", "cached_tokens", "output_tokens", "subagents", "subagent_requests",
    ],
    "session/session_requests": [
        "session_id", "step", "turn", "step_trigger", "start_ms", "end_ms", "ttft_ms", "model", "provider",
        "prompt_tokens", "cache_read_tokens", "uncached_tokens", "completion_tokens", "system_tokens", "user_tokens",
        "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason", "transition",
        "cause", "waited_for", "wait_s", "n_tool_calls",
    ],
    "session/session_tool_calls": [
        "session_id", "step", "call_index", "name", "category", "outcome", "result_tokens", "latency_ms",
    ],
}


# The `?` parameters of the queries that take them, in order, by the query's name.
QUERY_PARAMETERS: dict[str, list] = {
    "session/session_root": ["tree-grandchild"],
}

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
ALL_SCOPES = site_database.SCOPES_OF["All"]  # every scope of the data
SESSION_QUERIES_FOLDER = "session/"  # queries of the Session page, which read the selected session
SELECTED_SESSION = "tree-root"  # the fixture's first-week session with a tree of subagents

# The browser's database module, whose lists of setup statements the tests compare with the helper's.
DATABASE_MODULE = site_database.QUERIES_FOLDER.parent / "js" / "shared" / "database.js"


def browser_statement_names(constant: str) -> list[str]:
    """The quoted statement names, in order, of the list `const <constant> = Object.freeze([...]);` in database.js."""
    declaration = re.search(rf"const {constant} = Object\.freeze\(\[(.*?)\]\);", DATABASE_MODULE.read_text(), re.DOTALL)
    assert declaration is not None, f"{DATABASE_MODULE.name} declares no {constant}"
    return re.findall(r'"([^"]+)"', declaration.group(1))


def test_the_setup_statements_run_in_the_browser_s_order() -> None:
    assert site_database.VIEW_STATEMENTS == browser_statement_names("VIEW_STATEMENTS")
    assert site_database.SELECTION_TABLE_STATEMENTS == browser_statement_names("SELECTION_TABLE_STATEMENTS")


def test_every_create_statement_on_disk_is_run() -> None:
    on_disk = {f"setup/{path.stem}" for path in site_database.SETUP_FOLDER.glob("create_*.sql")}
    assert on_disk == {*site_database.VIEW_STATEMENTS, *site_database.SELECTION_TABLE_STATEMENTS}


def test_the_fixture_has_two_weeks(fixture_weeks: list[str]) -> None:
    assert fixture_weeks == [FIRST_SUNDAY, SECOND_SUNDAY]


@pytest.mark.parametrize("name", sorted(EXPECTED_COLUMNS))
def test_a_query_returns_its_columns(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str],
                                     name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, ALL_SCOPES)
    if name.startswith(SESSION_QUERIES_FOLDER):
        site_database.select_session(connection, FIRST_SUNDAY, SELECTED_SESSION)
    rows = site_database.run_query(connection, name, QUERY_PARAMETERS.get(name))
    assert list(rows.columns) == EXPECTED_COLUMNS[name]


def test_every_query_file_has_its_columns_listed_and_every_listed_query_has_a_file() -> None:
    assert sorted(EXPECTED_COLUMNS) == site_database.query_names()


def test_every_parameterised_query_is_listed() -> None:
    for name in QUERY_PARAMETERS:
        assert name in EXPECTED_COLUMNS, name


def test_every_query_file_starts_with_a_comment() -> None:
    for path in sorted(site_database.QUERIES_FOLDER.rglob("*.sql")):
        name = path.relative_to(site_database.QUERIES_FOLDER)
        lines = path.read_text().splitlines()
        assert lines, f"{name} is empty; its first line must be a -- comment saying what one row is"
        assert lines[0].startswith("--"), f"{name} starts with {lines[0]!r}, not a -- comment"


# Top-level requests of the fixture, counted by hand from `fixture_release.REQUESTS`: in the Agentic scope
# `tree-root` 5, `idle-week-1` 3, `mutation` 3 and `idle-week-2` 2; in the SWE-Bench scope `swe-bench` 2 and
# `idle-benchmark` 1. The subagents `tree-child`, `tree-sibling` and `tree-grandchild` are not top-level.
@pytest.mark.parametrize(("scope", "top_level_requests"), [("Agentic", 13), ("SWE-Bench", 3), ("All", 16)])
def test_the_request_count_is_the_number_of_top_level_requests(connection: duckdb.DuckDBPyConnection,
                                                               fixture_weeks: list[str], scope: str,
                                                               top_level_requests: int) -> None:
    site_database.select_weeks(connection, fixture_weeks, site_database.SCOPES_OF[scope])
    rows = site_database.run_query(connection, "explore/request_count")
    assert rows.requests.tolist() == [top_level_requests]


def test_a_new_selection_replaces_the_previous_one(connection: duckdb.DuckDBPyConnection,
                                                   fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, ALL_SCOPES)
    site_database.select_weeks(connection, [FIRST_SUNDAY], site_database.SCOPES_OF["Agentic"])
    rows = site_database.run_query(connection, "explore/request_count")
    assert rows.requests.tolist() == [8]  # `tree-root` 5 and `idle-week-1` 3, the first week's Agentic sessions


def test_a_new_session_replaces_the_previous_one(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_session(connection, SECOND_SUNDAY, "mutation")
    site_database.select_session(connection, FIRST_SUNDAY, SELECTED_SESSION)
    assert connection.table("selected_session").fetchall() == [(FIRST_SUNDAY, SELECTED_SESSION)]


def test_a_subagent_s_root_is_its_top_level_session(connection: duckdb.DuckDBPyConnection) -> None:
    rows = site_database.run_query(connection, "session/session_root", ["tree-grandchild"])
    assert rows.values.tolist() == [[SELECTED_SESSION, FIRST_SUNDAY]]


def test_an_unknown_id_has_no_root(connection: duckdb.DuckDBPyConnection) -> None:
    rows = site_database.run_query(connection, "session/session_root", ["no-such-session"])
    assert len(rows) == 0


def test_the_tree_holds_the_session_and_its_subagents_at_every_depth(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_session(connection, FIRST_SUNDAY, SELECTED_SESSION)
    rows = site_database.run_query(connection, "session/session_tree")
    assert rows.session_id.tolist() == ["tree-root", "tree-child", "tree-sibling", "tree-grandchild"]
    assert rows.depth.tolist() == [0, 1, 1, 2]


# `tree-root` 5 requests, `tree-child` 2, `tree-sibling` 2 and `tree-grandchild` 1, with 5, 2, 2 and 0 tool calls.
def test_the_tree_s_requests_and_tool_calls_are_those_of_every_session_in_it(
        connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_session(connection, FIRST_SUNDAY, SELECTED_SESSION)
    requests = site_database.run_query(connection, "session/session_requests")
    tool_calls = site_database.run_query(connection, "session/session_tool_calls")
    assert requests.session_id.value_counts().to_dict() == {
        "tree-root": 5, "tree-child": 2, "tree-sibling": 2, "tree-grandchild": 1}
    assert tool_calls.session_id.value_counts().to_dict() == {"tree-root": 5, "tree-child": 2, "tree-sibling": 2}


def test_a_session_of_another_week_selects_nothing(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_session(connection, SECOND_SUNDAY, SELECTED_SESSION)
    assert len(site_database.run_query(connection, "session/session_tree")) == 0
