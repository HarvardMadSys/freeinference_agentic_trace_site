"""Every query of the site, run as the data step runs it on the fixture release's frames, returns its columns."""

import duckdb
import pytest

import fixture_release
import site_database

# The columns of a histogram's two queries: its bins, and its count, maximum and percentiles.
BIN_COLUMNS = ["bin_start", "bin_end", "rows"]
STATS_COLUMNS = ["count", "max", "p50", "p75", "p90", "p95"]
# The columns of a quantile-range figure's query: per category, its count and five percentiles.
PERCENTILE_RANGE_COLUMNS = ["category", "rows", "p5", "p25", "p50", "p75", "p95"]
# The columns of a CDF of two scopes: per scope and point, the scope's rows and median, and the ratio of the medians.
SCOPE_CDF_COLUMNS = ["series", "x", "share", "rows", "median", "median_ratio"]

# The columns each query returns, in order, by the query's name. Every query file outside `setup/` has an entry.
EXPECTED_COLUMNS = {
    "explore/cached_fraction_bins": BIN_COLUMNS,
    "explore/cached_fraction_stats": STATS_COLUMNS,
    "explore/subagents_per_session_bins": BIN_COLUMNS,
    "explore/subagents_per_session_stats": STATS_COLUMNS,
    "explore/input_tokens_per_week": ["week", "requests", "cached_tokens", "uncached_tokens", "unreported_tokens"],
    "explore/model_mix": ["model", "requests"],
    "explore/sessions_per_week_by_harness": ["week", "harness", "sessions"],
    "explore/trace_totals": ["sessions", "requests", "input_tokens", "output_tokens", "cached_tokens", "tool_calls",
                             "harnesses", "benchmark_harnesses"],
    "explore/requests_per_week_by_model": ["week", "model", "requests"],
    "explore/sessions_of_selection": ["week", "session_id", "first_start_ms", "harness", "benchmark", "main_model",
                                      "requests", "turns", "tool_calls", "duration_s", "input_tokens",
                                      "reported_input_tokens", "cached_tokens", "peak_prompt_tokens"],
    "explore/sessions_first_page": ["week", "session_id", "first_start_ms", "harness", "benchmark", "main_model",
                                    "requests", "turns", "tool_calls", "duration_s", "input_tokens",
                                    "reported_input_tokens", "cached_tokens", "peak_prompt_tokens", "total_sessions"],
    "figures/requests_per_session_cdf": ["series", "x", "share", "rows"],
    "figures/duration_cdf": ["series", "x", "share", "rows"],
    "figures/tokens_per_request_cdf": ["series", "x", "share", "rows"],
    "figures/cost_share_by_session": ["percentile", "cached", "uncached", "output", "bin_sessions", "ranked_bin",
                                      "rows", "pooled_cached", "pooled_uncached", "pooled_output"],
    "figures/token_split_by_week": ["week", "part", "share", "rows"],
    "figures/token_growth_by_messages": ["bin_start", "rows", "median_cached_tokens", "median_uncached_tokens",
                                         "median_output_tokens"],
    "figures/context_share_by_role": ["bin_start", "role", "share", "rows"],
    "figures/ttft_cdf_by_model": ["series", "x", "share", "rows"],
    "figures/ttft_median_by_model": ["model", "rows", "median_ttft_s"],
    "figures/decode_cdf_by_model": ["series", "x", "share", "rows"],
    "figures/decode_median_by_model": ["model", "rows", "median_decode_s"],
    "figures/session_time_by_part": ["percentile", "prefill", "decode", "tool", "user", "bin_sessions", "ranked_bin",
                                     "rows", "mean_prefill_share", "mean_decode_share", "mean_tool_share",
                                     "mean_user_share"],
    "figures/speedup_if_twice_as_fast": ["part", "speedup", "rows"],
    "figures/latency_by_category": PERCENTILE_RANGE_COLUMNS,
    "figures/result_tokens_by_category": PERCENTILE_RANGE_COLUMNS,
    "figures/calls_per_request_by_category": ["category", "rows", "mean_calls"],
    "figures/latency_by_batch_width": ["width", "rows", "p10", "p25", "p50", "p75", "p90", "serial_s"],
    "figures/hit_ratio_cdf_by_gap_bin": ["series", "x", "share", "rows"],
    "figures/hit_ratio_by_idle_gap": ["provider", "idle_gap_bin", "rows", "median_hit_ratio"],
    "figures/gap_cdf_by_cause": ["series", "x", "share", "rows"],
    "figures/mean_hit_ratio_by_cause": ["waited_for", "rows", "mean_hit_ratio"],
    "figures/hit_ratio_cdf_by_transition": ["series", "x", "share", "rows"],
    "figures/tool_mix_by_turn_position": ["scope", "tenth", "tool_group", "calls", "share", "rows"],
    "figures/prefill_against_storage": ["scope", "ttl", "normalised_prefill", "mean_retained_tokens", "rows"],
    "figures/mutations_by_cause": ["table_row", "steps_share", "sessions_share", "prefill_share", "rows"],
    "figures/api_cost_by_ttl": ["ttl", "ttl_seconds", "part", "cost_multiple", "total_multiple", "is_knee", "rows"],
    "figures/infrastructure_cost_by_ttl": ["ttl", "ttl_seconds", "part", "cost_multiple", "total_multiple", "is_lowest",
                                           "rows"],
    "figures/turn_duration_by_scope": SCOPE_CDF_COLUMNS,
    "figures/session_duration_by_scope": SCOPE_CDF_COLUMNS,
    "figures/input_per_request_by_scope": SCOPE_CDF_COLUMNS,
    "figures/user_prompt_tokens_by_scope": SCOPE_CDF_COLUMNS,
    "buckets/week_tree": [
        "root_session_id", "session_id", "parent_session_id", "spawned_by_step", "depth", "harness", "requests",
        "user_steps", "tool_calls", "first_start_ms", "duration_s", "input_tokens",
        "reported_input_tokens", "cached_tokens", "output_tokens", "subagents", "subagent_requests",
    ],
    "buckets/week_requests": [
        "root_session_id", "session_id", "step", "turn", "step_trigger", "start_ms", "end_ms", "ttft_ms", "model",
        "provider", "prompt_tokens", "cache_read_tokens", "uncached_tokens", "completion_tokens", "system_tokens",
        "user_tokens", "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason",
        "transition", "cause", "waited_for", "wait_s",
    ],
    "buckets/week_tool_calls": [
        "root_session_id", "session_id", "step", "name", "category", "programs", "arguments_skeleton",
        "outcome", "result_tokens", "latency_ms",
    ],
}

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]

def test_every_create_statement_on_disk_is_run() -> None:
    on_disk = {f"setup/{path.stem}" for path in site_database.SETUP_FOLDER.glob("create_*.sql")}
    assert on_disk == {*site_database.SELECTION_TABLE_STATEMENTS, *site_database.SELECTION_VIEW_STATEMENTS,
                       site_database.BENCHMARK_TABLE_STATEMENT}


def test_the_fixture_has_two_weeks(fixture_weeks: list[str]) -> None:
    assert fixture_weeks == [FIRST_SUNDAY, SECOND_SUNDAY]


@pytest.mark.parametrize("name", sorted(EXPECTED_COLUMNS))
def test_a_query_returns_its_columns(connection: duckdb.DuckDBPyConnection, fixture_weeks: list[str],
                                     name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    rows = site_database.run_query(connection, name)
    assert list(rows.columns) == EXPECTED_COLUMNS[name]


def test_every_query_file_has_its_columns_listed_and_every_listed_query_has_a_file() -> None:
    assert sorted(EXPECTED_COLUMNS) == site_database.query_names()


def test_every_query_file_starts_with_a_comment() -> None:
    for path in sorted(site_database.QUERIES_FOLDER.rglob("*.sql")):
        name = path.relative_to(site_database.QUERIES_FOLDER)
        lines = path.read_text().splitlines()
        assert lines, f"{name} is empty; its first line must be a -- comment saying what one row is"
        assert lines[0].startswith("--"), f"{name} starts with {lines[0]!r}, not a -- comment"


def test_a_new_selection_replaces_the_previous_one(connection: duckdb.DuckDBPyConnection,
                                                   fixture_weeks: list[str]) -> None:
    site_database.select_weeks(connection, fixture_weeks, fixture_release.EVERY_HARNESS)
    site_database.select_weeks(connection, [FIRST_SUNDAY], fixture_release.PAPER_HARNESSES)
    rows = site_database.run_query(connection, "explore/trace_totals")
    assert rows.requests.tolist() == [8]  # `tree-root` 5 and `idle-week-1` 3, the first week's paper sessions
