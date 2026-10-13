"""The index of the release's harnesses: each harness with its number of top-level sessions over every week, and
whether it is the benchmark's.

A top-level session is one with no parent. A harness is the benchmark's when
the pipeline's population puts its sessions in the SWE-Bench scope; every
other harness is the paper's population. The index lists the harness with most
top-level sessions first, ties by name, and is read by the Explore page with
the weeks' index, before any answer.
"""

import dataclasses
import json
import pathlib

import pandas

from release import population
from site_data import paths


@dataclasses.dataclass(frozen=True)
class HarnessEntry:
    """One harness of the release, as `harnesses.json` lists it."""

    harness: str
    sessions: int  # its top-level sessions over every week
    benchmark: bool  # whether its sessions are the benchmark's, not the paper's population


def harnesses_index(sessions: pandas.DataFrame) -> list[HarnessEntry]:
    """Every harness of the sessions, subagents' included, with its top-level sessions; most sessions first, ties by
    name."""
    top_level = sessions[sessions.parent_session_id.isna()]
    entries = []
    for harness in sorted(sessions.harness.unique()):
        entries.append(HarnessEntry(
            harness=harness,
            sessions=int((top_level.harness == harness).sum()),
            benchmark=population.scope_of(harness) == population.SWE_BENCH,
        ))
    return sorted(entries, key=most_sessions_first)


def most_sessions_first(entry: HarnessEntry) -> tuple[int, str]:
    """The sort key of an entry: more sessions first, then the harness's name."""
    return (-entry.sessions, entry.harness)


def write_harnesses_file(entries: list[HarnessEntry], out_directory: pathlib.Path) -> pathlib.Path:
    """Write the index as `harnesses.json` and return its path."""
    path = out_directory / paths.HARNESSES_FILE
    path.write_text(json.dumps([dataclasses.asdict(entry) for entry in entries], indent=2) + "\n")
    return path


def read_harnesses_file(data_directory: pathlib.Path) -> list[HarnessEntry]:
    """The entries of the data folder's `harnesses.json`, in its order."""
    listed = json.loads((data_directory / paths.HARNESSES_FILE).read_text())
    return [HarnessEntry(**entry) for entry in listed]
