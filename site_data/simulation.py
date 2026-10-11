"""The site's simulation rows: the cache simulation's tallies of the paper's Agentic population in every simulated
week, unchanged, with `week` and the week's Agentic `active_token_seconds` and `output_tokens` added.

A simulated week's folder holds the tallies per scope, policy and TTL, and the
totals per scope; the site keeps the Agentic scope's tallies, without the
scope column, each with its week's Agentic totals. A week the simulation has
not covered contributes no rows. Each week's files are read directly, since
the pipeline's summing readers stop on a release week without a simulation,
which the site allows.
"""

import pathlib

import pandas

from release import population
from simulation import weekly_files
from site_data import weeks

# The frame's columns in order, with the types the simulation writes them in.
COLUMN_TYPES = {
    "week": "str",
    "policy": "str",
    "ttl": "str",
    "hit_tokens": "int64",
    "miss_tokens": "int64",
    "reusable_token_seconds": "float64",
    "dead_token_seconds": "float64",
    "active_token_seconds": "float64",
    "output_tokens": "float64",
}
COLUMNS = list(COLUMN_TYPES)


def simulation_frame(simulation_directory: pathlib.Path, entries: list[weeks.WeekEntry]) -> pandas.DataFrame:
    """The Agentic tallies of every simulated week among the entries, oldest first."""
    weekly = []
    for entry in entries:
        if entry.simulated:
            weekly.append(week_tallies(simulation_directory / weeks.folder_name(entry), entry.week))
    if not weekly:
        return no_rows()
    return pandas.concat(weekly, ignore_index=True)


def no_rows() -> pandas.DataFrame:
    """The frame without rows, its columns typed as a simulated week's are."""
    empty_columns = {}
    for column, column_type in COLUMN_TYPES.items():
        empty_columns[column] = pandas.Series(dtype=column_type)
    return pandas.DataFrame(empty_columns)


def week_tallies(simulated_week: pathlib.Path, week: str) -> pandas.DataFrame:
    """One simulated week's Agentic tallies, each with the week and the week's Agentic active token-seconds and
    output tokens."""
    tallies = pandas.read_parquet(simulated_week / weekly_files.TALLIES_FILE)
    totals = pandas.read_parquet(simulated_week / weekly_files.TOTALS_FILE)
    agentic_totals = totals[totals.scope == population.AGENTIC]
    if len(agentic_totals) != 1:
        raise ValueError(f"{simulated_week.name} has {len(agentic_totals)} rows of {population.AGENTIC} totals, "
                         "not one")
    agentic_tallies = tallies[tallies.scope == population.AGENTIC]
    rows = agentic_tallies.assign(
        week=week,
        active_token_seconds=agentic_totals.active_token_seconds.iloc[0],
        output_tokens=agentic_totals.output_tokens.iloc[0],
    )
    return rows[COLUMNS]
