"""The index of the release's weeks: each week's Sunday, Saturday and month, and whether the cache simulation covers it.

A week folder is named `<sunday>_<saturday>`. A week's month is the month of
its Sunday, so a week that spans two months belongs to the first. A week is
simulated when the simulation's `sources.json` for it records, for each of the
tallies, the totals and the per-request misses, the sha256 of the week's
current manifest: a week simulated from older traces counts as not simulated.

Every week has a file of requests, tool calls and sessions; only a simulated
week has a file of simulation rows.
"""

import dataclasses
import json
import pathlib

from release import reader
from simulation import weekly_files
from site_data import paths

# The simulation's files the site reads; a week is simulated when each was computed from the week's current traces.
SIMULATION_FILES = (weekly_files.TALLIES_FILE, weekly_files.TOTALS_FILE, weekly_files.REQUEST_MISSES_FILE)


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
    simulated = is_simulated(week_directory, simulation_directory / week_directory.name)
    return WeekEntry(week=sunday, last_day=saturday, month=sunday[: len("YYYY-MM")], simulated=simulated)


def is_simulated(week_directory: pathlib.Path, simulated_week: pathlib.Path) -> bool:
    """Whether the simulation's tallies, totals and per-request misses of the week were each computed from its
    current traces."""
    recorded = weekly_files.recorded_sources(simulated_week)
    current = weekly_files.traces_source(week_directory)
    for file_name in SIMULATION_FILES:
        if recorded.get(file_name) != current:
            return False
    return True


def folder_name(entry: WeekEntry) -> str:
    """The week's folder name in the release and in the simulation: `<sunday>_<saturday>`."""
    return f"{entry.week}_{entry.last_day}"


def weeks_index(release_directory: pathlib.Path, simulation_directory: pathlib.Path) -> list[WeekEntry]:
    """Every week of the release, oldest first."""
    week_directories = reader.find_weeks(release_directory, weeks=None)
    return [week_entry(week_directory, simulation_directory) for week_directory in week_directories]


def write_weeks_file(entries: list[WeekEntry], out_directory: pathlib.Path) -> pathlib.Path:
    """Write the index as `weeks.json` and return its path."""
    path = out_directory / paths.WEEKS_FILE
    path.write_text(json.dumps([dataclasses.asdict(entry) for entry in entries], indent=2) + "\n")
    return path


def read_weeks_file(data_directory: pathlib.Path) -> list[WeekEntry]:
    """The entries of the data folder's `weeks.json`, oldest first."""
    listed = json.loads((data_directory / paths.WEEKS_FILE).read_text())
    return [WeekEntry(**entry) for entry in listed]


def weeks_with_file(entries: list[WeekEntry], kind_folder: str) -> list[str]:
    """The Sundays of the weeks that have a file of the kind `kind_folder`: every week, or for the simulation, the
    simulated weeks."""
    if kind_folder == paths.SIMULATION_FOLDER:
        return [entry.week for entry in entries if entry.simulated]
    return [entry.week for entry in entries]
