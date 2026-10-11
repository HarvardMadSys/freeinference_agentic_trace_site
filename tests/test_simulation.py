"""The site's simulation rows on the fixture: the first week's Agentic tallies with the week's Agentic totals."""

import pathlib

from site_data import simulation, weeks

import fixture_release

SITE_COLUMNS = [
    "week", "policy", "ttl", "hit_tokens", "miss_tokens", "reusable_token_seconds", "dead_token_seconds",
    "active_token_seconds", "output_tokens",
]


def fixture_entries(tmp_path: pathlib.Path) -> list[weeks.WeekEntry]:
    """The index of the fixture release, written under tmp_path."""
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    return weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")


def test_only_the_first_week_is_simulated(tmp_path: pathlib.Path) -> None:
    entries = fixture_entries(tmp_path)
    assert [(entry.week, entry.simulated) for entry in entries] == [("2026-05-31", True), ("2026-06-07", False)]


def test_the_simulated_week_s_agentic_tallies_appear_unchanged(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path))
    assert list(rows.columns) == SITE_COLUMNS
    assert rows.week.tolist() == ["2026-05-31"] * 3  # the second week contributes none, the SWE-Bench tally neither
    assert rows.ttl.tolist() == ["5m", "1h", "5m"]
    assert rows.hit_tokens.tolist() == [6_000, 8_000, 6_000]
    assert rows.dead_token_seconds.tolist() == [500.0, 2_000.0, 0.0]


def test_each_row_carries_the_week_s_agentic_totals(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path))
    assert rows.active_token_seconds.tolist() == [20_000.0] * 3
    assert rows.output_tokens.tolist() == [1_300.0] * 3


def test_no_simulated_week_gives_no_rows(tmp_path: pathlib.Path) -> None:
    rows = simulation.simulation_frame(tmp_path / "simulation", fixture_entries(tmp_path)[1:])
    assert rows.empty and list(rows.columns) == SITE_COLUMNS
