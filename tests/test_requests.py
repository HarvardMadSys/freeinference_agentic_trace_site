"""The site's requests on the fixture release, checked against values computed by hand from its rows."""

import pathlib

import pandas

from site_data import loading, requests, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "session_id", "step", "start_ms", "end_ms", "ttft_ms", "model", "provider", "step_trigger",
    "waited_for", "prompt_tokens", "completion_tokens", "cache_read_tokens", "system_tokens", "user_tokens",
    "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason", "transition",
    "cause", "scope", "is_top_level", "root_session_id", "depth", "turn", "uncached_tokens", "hit_ratio", "wait_s",
    "idle_gap_s", "idle_gap_bin", "is_trusted_ttft", "n_tool_calls",
]


def fixture_requests(tmp_path: pathlib.Path) -> pandas.DataFrame:
    """The site's requests of the fixture release, indexed by session and step."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries)
    return requests.requests_frame(release).set_index(["session_id", "step"], drop=False)


def test_every_request_of_every_session_is_a_row(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert len(site_requests) == 21
    assert list(site_requests.columns) == SITE_COLUMNS


def test_types_are_nullable_integers_booleans_and_strings(tmp_path: pathlib.Path) -> None:
    dtypes = fixture_requests(tmp_path).dtypes
    for column in ("ttft_ms", "cache_read_tokens", "uncached_tokens", "idle_gap_bin"):
        assert dtypes[column] == "Int64", column
    for column in ("is_top_level", "is_trusted_ttft"):
        assert dtypes[column] == bool, column
    for column in ("week", "scope", "root_session_id", "session_id"):
        assert dtypes[column] == "str", column


def test_a_request_carries_the_week_of_its_folder(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert site_requests.week[("tree-root", 0)] == "2026-05-31"
    assert site_requests.week[("idle-week-2", 0)] == "2026-06-07"


def test_a_tool_step_continues_its_turn_after_a_wait(tmp_path: pathlib.Path) -> None:
    tool_step = fixture_requests(tmp_path).loc[("tree-root", 2)]
    assert tool_step.turn == 1
    assert tool_step.wait_s == 70.0  # starts at 1,100 s; step 1 ended at 1,030 s


def test_a_user_step_starts_the_next_turn_and_step_0_has_no_wait(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert site_requests.turn[("idle-week-2", 1)] == 2
    assert pandas.isna(site_requests.wait_s[("idle-week-2", 0)])


def test_the_nested_subagent_is_two_below_its_root(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    grandchild = site_requests.loc[("tree-grandchild", 0)]
    child = site_requests.loc[("tree-child", 0)]
    root = site_requests.loc[("tree-root", 0)]
    assert (grandchild.depth, grandchild.root_session_id, grandchild.is_top_level) == (2, "tree-root", False)
    assert (child.depth, child.root_session_id, child.is_top_level) == (1, "tree-root", False)
    assert (root.depth, root.root_session_id, root.is_top_level) == (0, "tree-root", True)


def test_scope_follows_the_session_harness(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert site_requests.scope[("swe-bench", 0)] == "SWE-Bench"
    assert site_requests.scope[("tree-child", 0)] == "Agentic"


def test_tool_calls_are_counted_per_request(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert site_requests.n_tool_calls[("tree-root", 1)] == 2
    assert site_requests.n_tool_calls[("tree-root", 4)] == 0
    assert site_requests.n_tool_calls.sum() == 16


def test_cache_columns_are_missing_where_the_provider_reports_no_cache_reads(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    benchmark = site_requests.loc[[("swe-bench", 0), ("swe-bench", 1)]]
    assert benchmark.hit_ratio.isna().all() and benchmark.uncached_tokens.isna().all()
    reporting = site_requests.loc[("tree-root", 1)]
    assert (reporting.hit_ratio, reporting.uncached_tokens) == (0.5, 1_000)  # 1,000 of 2,000 tokens cached


def test_the_trusted_ttft_is_under_95_percent_of_the_latency(tmp_path: pathlib.Path) -> None:
    trusted = fixture_requests(tmp_path).is_trusted_ttft
    assert trusted[("tree-root", 0)]  # 2 s of 10 s
    assert not trusted[("tree-root", 2)]  # 9.9 s of 10 s
    assert not trusted[("tree-root", 3)]  # no TTFT reported


def test_the_idle_gap_crosses_the_week_boundary(tmp_path: pathlib.Path) -> None:
    first_of_week_2 = fixture_requests(tmp_path).loc[("idle-week-2", 0)]
    # 4,200 s into the second week, after a request that ended 604,200 s into the first: 604,800 + 4,200 - 604,200.
    assert first_of_week_2.idle_gap_s == 4_800.0
    assert pandas.isna(first_of_week_2.idle_gap_bin)  # over an hour


def test_idle_gaps_fall_in_their_bins(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    assert site_requests.idle_gap_s[("idle-week-1", 1)] == 20.0
    assert site_requests.idle_gap_bin[("idle-week-1", 1)] == 3  # edges 10 × 1.254^k: 19.7 s to 24.8 s
    assert site_requests.idle_gap_s[("idle-week-1", 2)] == 5.0
    assert site_requests.idle_gap_bin[("idle-week-1", 2)] == 0  # under 10 s counts in the first bin


def test_the_idle_gap_looks_at_the_requests_of_its_own_scope_only(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    # The same user's SWE-Bench request at the same provider ended 2,010 s into the second week, which would make
    # the gap 2,190 s; the Agentic gap reaches back to the user's previous Agentic request instead.
    assert site_requests.idle_gap_s[("idle-week-2", 0)] == 4_800.0
    assert pandas.isna(site_requests.idle_gap_s[("idle-benchmark", 0)])  # the user's first SWE-Bench request


def test_the_idle_gap_looks_at_top_level_sessions_only(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    # Its subagents' last request ended at 1,070 s, which would make the gap 30 s; they are left out.
    assert site_requests.idle_gap_s[("tree-root", 2)] == 70.0
    assert site_requests[~site_requests.is_top_level].idle_gap_s.isna().all()


def test_role_tokens_and_transitions_keep_their_release_values(tmp_path: pathlib.Path) -> None:
    site_requests = fixture_requests(tmp_path)
    tool_step = site_requests.loc[("tree-root", 2)]
    assert (tool_step.system_tokens, tool_step.assistant_tokens, tool_step.tool_definition_tokens) == (100, 100, 300)
    mutation = site_requests.loc[("mutation", 1)]
    assert (mutation.transition, mutation.cause) == ("mutation", "compaction")
