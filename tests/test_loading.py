"""Every row of the loaded release carries the week folder it was read from."""

import pathlib

from site_data import loading, weeks

import fixture_release


def test_every_row_carries_the_sunday_of_its_week_folder(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries)
    assert release.sessions.week.value_counts().to_dict() == {"2026-05-31": 6, "2026-06-07": 2}
    assert release.requests.week.value_counts().to_dict() == {"2026-05-31": 15, "2026-06-07": 5}
    assert release.tool_calls.week.value_counts().to_dict() == {"2026-05-31": 14, "2026-06-07": 2}


def test_only_the_listed_weeks_are_loaded(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    entries = weeks.weeks_index(tmp_path / "release", tmp_path / "simulation")
    release = loading.load_release(tmp_path / "release", entries[1:])
    assert sorted(release.sessions.session_id) == ["idle-week-2", "mutation"]
