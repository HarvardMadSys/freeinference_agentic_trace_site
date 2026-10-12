"""The site's simulation rows on the fixture: the first week's TTL-only tallies of both scopes, each with its scope's
totals of the week."""

import pathlib

import pandas
import pytest

from release import population
from simulation import cache, weekly_files
from site_data import simulation, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "scope", "ttl", "hit_tokens", "miss_tokens", "reusable_token_seconds", "dead_token_seconds",
    "active_token_seconds", "span_seconds", "output_tokens",
]


def fixture_entries(tmp_path: pathlib.Path) -> list[weeks.WeekEntry]:
    """The index of the fixture release, written under tmp_path."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    return weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")


def fixture_rows(tmp_path: pathlib.Path) -> pandas.DataFrame:
    """The site's simulation rows of the fixture, written under tmp_path."""
    return simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path))


def test_only_the_first_week_is_simulated(tmp_path: pathlib.Path) -> None:
    entries = fixture_entries(tmp_path)
    assert [(entry.week, entry.simulated) for entry in entries] == [("2026-05-31", True), ("2026-06-07", False)]


def test_the_kept_policy_is_one_the_simulation_runs() -> None:
    assert simulation.KEPT_POLICY in cache.POLICIES


def test_the_simulated_week_s_ttl_only_tallies_of_both_scopes_appear_unchanged(tmp_path: pathlib.Path) -> None:
    rows = fixture_rows(tmp_path)
    assert list(rows.columns) == SITE_COLUMNS
    assert rows.week.tolist() == ["2026-05-31"] * 8  # the second week contributes none, the reclaim_both tally neither
    assert rows.scope.tolist() == [population.AGENTIC] * 4 + [population.SWE_BENCH] * 4
    assert rows.ttl.tolist() == ["1m", "5m", "1h", "none"] * 2
    assert rows.hit_tokens.tolist() == [5_000, 6_000, 8_000, 8_400, 800, 1_000, 1_500, 1_600]
    assert rows.dead_token_seconds.tolist() == [100.0, 500.0, 2_000.0, 5_000_000.0, 20.0, 50.0, 80.0, 200.0]


def test_each_row_carries_its_scope_s_totals_of_the_week(tmp_path: pathlib.Path) -> None:
    rows = fixture_rows(tmp_path)
    assert rows.active_token_seconds.tolist() == [20_000.0] * 4 + [2_000.0] * 4
    assert rows.span_seconds.tolist() == [603_200.0] * 4 + [25.0] * 4
    assert rows.output_tokens.tolist() == [1_300.0] * 4 + [200.0] * 4


def test_no_simulated_week_gives_no_rows(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path)[1:])
    assert rows.empty and list(rows.columns) == SITE_COLUMNS


def test_a_scope_with_tallies_and_no_totals_is_refused(tmp_path: pathlib.Path) -> None:
    entries = fixture_entries(tmp_path)
    totals_path = tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / weekly_files.TOTALS_FILE
    totals = pandas.read_parquet(totals_path)
    totals[totals.scope == population.AGENTIC].to_parquet(totals_path, index=False)
    with pytest.raises(ValueError, match="has tallies but no totals of SWE-Bench"):
        simulation.simulation_frame(tmp_path / "simulation", entries)


def test_the_request_misses_are_the_simulated_week_s_each_with_its_week(tmp_path: pathlib.Path) -> None:
    misses = simulation.request_misses_frame(tmp_path / "simulation", fixture_entries(tmp_path))
    assert list(misses.columns) == ["week", "session_id", "step", "missed_tokens"]
    assert misses.week.unique().tolist() == ["2026-05-31"]
    assert sorted(misses.session_id.unique()) == ["idle-week-1", "swe-bench", "tree-root"]
    assert misses.missed_tokens.sum() == 7_440


def test_no_simulated_week_gives_no_request_misses(tmp_path: pathlib.Path) -> None:
    misses = simulation.request_misses_frame(tmp_path / "simulation", fixture_entries(tmp_path)[1:])
    assert misses.empty and misses.step.dtype == "int32"
