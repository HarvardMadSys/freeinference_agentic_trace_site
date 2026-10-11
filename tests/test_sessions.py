"""The site's sessions on the fixture release, checked against values computed by hand from its rows."""

import pathlib

import pandas

from site_data import loading, requests, sessions, simulation, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "session_id", "harness", "parent_session_id", "spawned_by_step", "root_session_id", "depth",
    "user_id", "requests", "user_steps", "tool_steps", "tool_calls", "first_start_ms", "duration_s", "input_tokens",
    "cached_tokens", "reported_input_tokens", "output_tokens", "peak_prompt_tokens", "main_model", "subagents",
    "subagent_requests",
]
FIRST_SUNDAY_MS = 1_780_185_600_000  # 2026-05-31 00:00 UTC


def fixture_frames(tmp_path: pathlib.Path) -> tuple[pandas.DataFrame, pandas.DataFrame]:
    """The site's requests and sessions of the fixture release, the sessions indexed by session id."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries)
    request_misses = simulation.request_misses_frame(tmp_path / "simulation", entries)
    site_requests = requests.requests_frame(release, request_misses)
    site_sessions = sessions.sessions_frame(release, site_requests)
    return site_requests, site_sessions.set_index("session_id", drop=False)


def test_every_session_is_a_row(tmp_path: pathlib.Path) -> None:
    site_sessions = fixture_frames(tmp_path)[1]
    assert len(site_sessions) == 9
    assert list(site_sessions.columns) == SITE_COLUMNS


def test_the_top_level_session_totals_its_own_requests(tmp_path: pathlib.Path) -> None:
    root = fixture_frames(tmp_path)[1].loc["tree-root"]
    assert (root.requests, root.user_steps, root.tool_steps, root.tool_calls) == (5, 1, 4, 5)
    assert root.first_start_ms == FIRST_SUNDAY_MS + 1_000_000
    assert root.duration_s == 310.0  # from 1,000 s to 1,310 s; its subagents' requests fall inside but do not count
    assert (root.input_tokens, root.cached_tokens, root.output_tokens) == (15_000, 10_000, 500)
    assert root.reported_input_tokens == 15_000  # every request of its provider reports cache reads
    assert root.peak_prompt_tokens == 5_000


def test_totals_equal_the_sums_of_each_session_s_requests(tmp_path: pathlib.Path) -> None:
    site_requests, site_sessions = fixture_frames(tmp_path)
    by_session = site_requests.groupby("session_id")
    assert by_session.size().to_dict() == site_sessions.requests.to_dict()
    assert by_session.prompt_tokens.sum().to_dict() == site_sessions.input_tokens.to_dict()
    assert by_session.completion_tokens.sum().to_dict() == site_sessions.output_tokens.to_dict()
    assert by_session.cache_read_tokens.sum().to_dict() == site_sessions.cached_tokens.to_dict()


def test_a_session_whose_provider_reports_no_cache_reads_has_no_reported_input(tmp_path: pathlib.Path) -> None:
    benchmark = fixture_frames(tmp_path)[1].loc["swe-bench"]
    assert (benchmark.cached_tokens, benchmark.reported_input_tokens) == (0, 0)
    assert (benchmark.input_tokens, benchmark.harness) == (1_800, "eval:swe-bench")


def test_a_top_level_session_counts_its_subagents_at_every_depth(tmp_path: pathlib.Path) -> None:
    site_sessions = fixture_frames(tmp_path)[1]
    root = site_sessions.loc["tree-root"]
    assert (root.subagents, root.subagent_requests) == (3, 5)  # child 2, sibling 2, grandchild 1
    child = site_sessions.loc["tree-child"]
    assert (child.subagents, child.subagent_requests) == (0, 0)  # a subagent, though it spawned one
    assert (site_sessions.loc["swe-bench"].subagents, site_sessions.loc["swe-bench"].subagent_requests) == (0, 0)


def test_a_subagent_of_a_subagent_is_two_below_its_root(tmp_path: pathlib.Path) -> None:
    grandchild = fixture_frames(tmp_path)[1].loc["tree-grandchild"]
    assert (grandchild.root_session_id, grandchild.depth) == ("tree-root", 2)
    assert (grandchild.parent_session_id, grandchild.spawned_by_step) == ("tree-child", 0)


def test_a_top_level_session_has_no_parent_and_no_spawning_step(tmp_path: pathlib.Path) -> None:
    site_sessions = fixture_frames(tmp_path)[1]
    assert site_sessions.spawned_by_step.dtype == "Int64"
    root = site_sessions.loc["tree-root"]
    assert pandas.isna(root.parent_session_id) and pandas.isna(root.spawned_by_step)
    assert (root.root_session_id, root.depth) == ("tree-root", 0)


def test_the_main_model_is_the_model_of_most_requests(tmp_path: pathlib.Path) -> None:
    site_sessions = fixture_frames(tmp_path)[1]
    assert site_sessions.main_model["swe-bench"] == "model-y"
    assert site_sessions.main_model["tree-root"] == "model-x"


def test_a_tie_between_models_goes_to_the_first_in_name_order(tmp_path: pathlib.Path) -> None:
    # One request each: model-y at step 0, model-x at step 1.
    assert fixture_frames(tmp_path)[1].main_model["tree-sibling"] == "model-x"


def test_a_session_carries_the_week_of_its_folder_and_counts_user_steps(tmp_path: pathlib.Path) -> None:
    second = fixture_frames(tmp_path)[1].loc["idle-week-2"]
    assert (second.week, second.user_steps, second.tool_steps) == ("2026-06-07", 2, 0)
