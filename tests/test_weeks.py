"""The index of weeks: folder names become entries, and a week is simulated when its tallies exist."""

import json
import pathlib

from site_data import weeks


def make_week(release_directory: pathlib.Path, name: str) -> pathlib.Path:
    """An empty week folder with the manifest the reader looks for."""
    week_directory = release_directory / name
    week_directory.mkdir(parents=True)
    (week_directory / "manifest.json").write_text("{}")
    return week_directory


def test_a_week_spanning_two_months_belongs_to_the_first(tmp_path: pathlib.Path) -> None:
    week_directory = make_week(tmp_path / "release", "2026-05-31_2026-06-06")
    entry = weeks.week_entry(week_directory, tmp_path / "simulation")
    assert entry == weeks.WeekEntry(week="2026-05-31", last_day="2026-06-06", month="2026-05", simulated=False)


def test_an_entry_names_the_folder_it_was_read_from(tmp_path: pathlib.Path) -> None:
    week_directory = make_week(tmp_path / "release", "2026-05-31_2026-06-06")
    assert weeks.folder_name(weeks.week_entry(week_directory, tmp_path / "simulation")) == "2026-05-31_2026-06-06"


def test_a_week_is_simulated_when_its_tallies_exist(tmp_path: pathlib.Path) -> None:
    week_directory = make_week(tmp_path / "release", "2026-08-30_2026-09-05")
    tallies = tmp_path / "simulation" / "2026-08-30_2026-09-05" / weeks.SIMULATED_MARKER_FILE
    tallies.parent.mkdir(parents=True)
    tallies.write_bytes(b"")
    assert weeks.week_entry(week_directory, tmp_path / "simulation").simulated


def test_the_index_lists_every_week_oldest_first(tmp_path: pathlib.Path) -> None:
    release_directory = tmp_path / "release"
    make_week(release_directory, "2026-08-30_2026-09-05")
    make_week(release_directory, "2026-05-17_2026-05-23")
    entries = weeks.weeks_index(release_directory, tmp_path / "simulation")
    assert [entry.week for entry in entries] == ["2026-05-17", "2026-08-30"]


def test_the_weeks_file_holds_one_object_per_week(tmp_path: pathlib.Path) -> None:
    entries = [weeks.WeekEntry(week="2026-05-17", last_day="2026-05-23", month="2026-05", simulated=True)]
    path = weeks.write_weeks_file(entries, tmp_path)
    assert json.loads(path.read_text()) == [
        {"week": "2026-05-17", "last_day": "2026-05-23", "month": "2026-05", "simulated": True}
    ]
