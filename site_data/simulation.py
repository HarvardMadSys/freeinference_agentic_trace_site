"""The site's simulation rows: the cache simulation's tallies of both scopes, the paper's Agentic population and the
benchmark's, under the TTL-only policy in every simulated week, unchanged, with `week` and the scope's
`active_token_seconds`, `span_seconds` and `output_tokens` of the week added.

A simulated week's folder holds the tallies per scope, policy and TTL, and the
totals per scope; the site keeps the tallies of the TTL-only policy, without
the policy column, each with its scope's totals of its week. A week the
simulation has not covered contributes no rows. Each week's files are read
directly, since the pipeline's summing readers stop on a release week without a
simulation, which the site allows.
"""

import pathlib

import pandas

from simulation import weekly_files
from site_data import weeks

KEPT_POLICY = "ttl_only"  # the one eviction policy the site keeps: a block leaves the cache only when its TTL runs out
TOTALS_KEPT = ["active_token_seconds", "span_seconds", "output_tokens"]  # the scope's totals each tally row carries
# The frame's columns in order, with the types the simulation writes them in.
COLUMN_TYPES = {
    "week": "str",
    "scope": "str",
    "ttl": "str",
    "hit_tokens": "int64",
    "miss_tokens": "int64",
    "reusable_token_seconds": "float64",
    "dead_token_seconds": "float64",
    "active_token_seconds": "float64",
    "span_seconds": "float64",
    "output_tokens": "float64",
}
COLUMNS = list(COLUMN_TYPES)


def simulation_frame(simulation_directory: pathlib.Path, entries: list[weeks.WeekEntry]) -> pandas.DataFrame:
    """The TTL-only tallies of both scopes of every simulated week among the entries, oldest first."""
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
    """One simulated week's TTL-only tallies of every scope, each with the week and its scope's active
    token-seconds, span and output tokens of the week; every scope with tallies must have exactly one row of totals."""
    tallies = pandas.read_parquet(simulated_week / weekly_files.TALLIES_FILE)
    totals = pandas.read_parquet(simulated_week / weekly_files.TOTALS_FILE)
    repeated = totals.scope[totals.scope.duplicated()].unique()
    if len(repeated) > 0:
        raise ValueError(f"{simulated_week.name} has more than one row of totals of {', '.join(repeated)}")
    kept_tallies = tallies[tallies.policy == KEPT_POLICY]
    rows = kept_tallies.merge(totals[["scope", *TOTALS_KEPT]], on="scope", how="left", validate="many_to_one")
    without_totals = rows.scope[rows.active_token_seconds.isna()].unique()
    if len(without_totals) > 0:
        raise ValueError(f"{simulated_week.name} has tallies but no totals of {', '.join(without_totals)}")
    return rows.assign(week=week)[COLUMNS]
