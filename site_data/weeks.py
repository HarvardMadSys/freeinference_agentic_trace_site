"""The index of the release's weeks: each week's Sunday, Saturday and month, and whether the cache simulation covers it.

A week folder is named `<sunday>_<saturday>`. A week's month is the month of
its Sunday, so a week that spans two months belongs to the first.
"""

import dataclasses
import json
import pathlib

from release import reader

WEEKS_FILE = "weeks.json"  # the index, read by every page before DuckDB loads
SIMULATED_MARKER_FILE = "tallies.parquet"  # a simulated week's folder holds this file


@dataclasses.dataclass(frozen=True)
class WeekEntry:
    """One week of the release, as `weeks.json` lists it."""

    week: str  # the Sunday, YYYY-MM-DD
    last_day: str  # the Saturday, YYYY-MM-DD
    month: str  # YYYY-MM of the Sunday
    simulated: bool  # whether the cache simulation has rows for this week


def week_entry(week_directory: pathlib.Path, simulation_directory: pathlib.Path) -> WeekEntry:
    """The index entry of one week folder."""
    sunday, saturday = week_directory.name.split("_")
    simulated = (simulation_directory / week_directory.name / SIMULATED_MARKER_FILE).exists()
    return WeekEntry(week=sunday, last_day=saturday, month=sunday[: len("YYYY-MM")], simulated=simulated)


def weeks_index(release_directory: pathlib.Path, simulation_directory: pathlib.Path) -> list[WeekEntry]:
    """Every week of the release, oldest first."""
    week_directories = reader.find_weeks(release_directory, weeks=None)
    return [week_entry(week_directory, simulation_directory) for week_directory in week_directories]


def write_weeks_file(entries: list[WeekEntry], out_directory: pathlib.Path) -> pathlib.Path:
    """Write the index as `weeks.json` and return its path."""
    path = out_directory / WEEKS_FILE
    path.write_text(json.dumps([dataclasses.asdict(entry) for entry in entries], indent=2) + "\n")
    return path
