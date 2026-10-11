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
    assert rows.week.tolist() == ["2026-05-31"] * 4  # the second week contributes none, the reclaim_both tally neither
    assert rows.scope.tolist() == [population.AGENTIC] * 2 + [population.SWE_BENCH] * 2
    assert rows.ttl.tolist() == ["5m", "1h", "5m", "1h"]
    assert rows.hit_tokens.tolist() == [6_000, 8_000, 1_000, 1_500]
    assert rows.dead_token_seconds.tolist() == [500.0, 2_000.0, 50.0, 80.0]


def test_each_row_carries_its_scope_s_totals_of_the_week(tmp_path: pathlib.Path) -> None:
    rows = fixture_rows(tmp_path)
    assert rows.active_token_seconds.tolist() == [20_000.0] * 2 + [2_000.0] * 2
    assert rows.span_seconds.tolist() == [603_200.0] * 2 + [25.0] * 2
    assert rows.output_tokens.tolist() == [1_300.0] * 2 + [200.0] * 2


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
