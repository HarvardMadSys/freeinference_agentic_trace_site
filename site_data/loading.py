"""The release's sessions, requests and tool calls, read week by week through the pipeline's reader.

Every row carries `week`, the Sunday of the week folder it was read from,
since the reader's frames do not say which week a row came from.
"""

import pathlib

import pandas

from release import reader
from site_data import weeks


def load_release(release_directory: pathlib.Path, entries: list[weeks.WeekEntry]) -> reader.Release:
    """The rows of the listed weeks, each with the `week` it was read from; every week is checked by the reader."""
    sessions, requests, tool_calls = [], [], []
    for entry in entries:
        week_rows = reader.load(release_directory, weeks=[entry.week])
        sessions.append(week_rows.sessions.assign(week=entry.week))
        requests.append(week_rows.requests.assign(week=entry.week))
        tool_calls.append(week_rows.tool_calls.assign(week=entry.week))
    return reader.Release(
        requests=pandas.concat(requests, ignore_index=True),
        sessions=pandas.concat(sessions, ignore_index=True),
        tool_calls=pandas.concat(tool_calls, ignore_index=True),
    )
