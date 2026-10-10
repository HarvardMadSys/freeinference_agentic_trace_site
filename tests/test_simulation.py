"""The site's simulation rows on the fixture: the first week's tallies with their scope's active token-seconds."""

import pathlib

from site_data import simulation, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "scope", "policy", "ttl", "hit_tokens", "miss_tokens", "reusable_token_seconds", "dead_token_seconds",
    "active_token_seconds",
]


def fixture_entries(tmp_path: pathlib.Path) -> list[weeks.WeekEntry]:
    """The index of the fixture release, written under tmp_path."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    return weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")


def test_only_the_first_week_is_simulated(tmp_path: pathlib.Path) -> None:
    entries = fixture_entries(tmp_path)
    assert [(entry.week, entry.simulated) for entry in entries] == [("2026-05-31", True), ("2026-06-07", False)]


def test_the_simulated_week_s_tallies_appear_unchanged(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path))
    assert list(rows.columns) == SITE_COLUMNS
    assert rows.week.tolist() == ["2026-05-31"] * 4  # the second week contributes none
    assert rows.ttl.tolist() == ["5m", "1h", "5m", "5m"]
    assert rows.hit_tokens.tolist() == [6_000, 8_000, 6_000, 1_000]
    assert rows.dead_token_seconds.tolist() == [500.0, 2_000.0, 0.0, 50.0]


def test_each_row_carries_its_scope_s_active_token_seconds(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path))
    assert dict(zip(rows.scope, rows.active_token_seconds)) == {"Agentic": 20_000.0, "SWE-Bench": 2_000.0}


def test_no_simulated_week_gives_no_rows(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path)[1:])
    assert rows.empty and list(rows.columns) == SITE_COLUMNS
