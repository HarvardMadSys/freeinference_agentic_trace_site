"""The site's simulation rows: the cache simulation's tallies of every simulated week, unchanged, with `week` and
the week's `active_token_seconds` added.

A simulated week's folder holds the tallies per scope, policy and TTL, and the
totals per scope; a row's `active_token_seconds` is its week's total for its
scope. A week the simulation has not covered contributes no rows. Each week's
files are read directly, since the pipeline's summing readers stop on a
release week without a simulation, which the site allows.
"""

import pathlib

import pandas

from simulation import weekly_files
from site_data import weeks

# The frame's columns in order, with the types the simulation writes them in.
COLUMN_TYPES = {
    "week": "str",
    "scope": "str",
    "policy": "str",
    "ttl": "str",
    "hit_tokens": "int64",
    "miss_tokens": "int64",
    "reusable_token_seconds": "float64",
    "dead_token_seconds": "float64",
    "active_token_seconds": "float64",
}
COLUMNS = list(COLUMN_TYPES)


def simulation_frame(simulation_directory: pathlib.Path, entries: list[weeks.WeekEntry]) -> pandas.DataFrame:
    """The tallies of every simulated week among the entries, oldest first."""
    weekly = []
    for entry in entries:
        if entry.simulated:
            weekly.append(week_tallies(simulation_directory / weeks.folder_name(entry), entry.week))
    if not weekly:
        return no_rows()
    return pandas.concat(weekly, ignore_index=True)


def no_rows() -> pandas.DataFrame:
    """The frame without rows, its columns typed as a simulated week's are, so its file has the same schema."""
    empty_columns = {}
    for column, column_type in COLUMN_TYPES.items():
        empty_columns[column] = pandas.Series(dtype=column_type)
    return pandas.DataFrame(empty_columns)


def week_tallies(simulated_week: pathlib.Path, week: str) -> pandas.DataFrame:
    """One simulated week's tallies, each with the week and the active token-seconds of its scope."""
    tallies = pandas.read_parquet(simulated_week / weekly_files.TALLIES_FILE)
    totals = pandas.read_parquet(simulated_week / weekly_files.TOTALS_FILE)
    rows = tallies.merge(totals[["scope", "active_token_seconds"]], on="scope", how="left", validate="many_to_one")
    without_totals = rows.scope[rows.active_token_seconds.isna()].unique()
    if len(without_totals) > 0:
        raise ValueError(f"{simulated_week.name} has tallies but no totals for {', '.join(without_totals)}")
    return rows.assign(week=week)[COLUMNS]
