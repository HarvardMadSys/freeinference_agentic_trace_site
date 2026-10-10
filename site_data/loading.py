"""The release's sessions, requests and tool calls, read week by week through the pipeline's reader.

Every row carries `week`, the Sunday of the week folder it was read from,
since the reader's frames do not say which week a row came from. pandas reads
an integer column that holds nulls as float; `with_nullable_integers` gives
such a column back its integer type, with the nulls kept.
"""

import dataclasses
import pathlib

import pandas
import pyarrow

from release import reader
from site_data import weeks


@dataclasses.dataclass
class WeekTaggedRelease:
    """The reader's sessions, requests and tool calls of the loaded weeks; every row carries its `week`."""

    requests: pandas.DataFrame
    sessions: pandas.DataFrame
    tool_calls: pandas.DataFrame


def load_release(release_directory: pathlib.Path, entries: list[weeks.WeekEntry]) -> WeekTaggedRelease:
    """The rows of the listed weeks, each with the `week` it was read from; every week is checked by the reader."""
    sessions, requests, tool_calls = [], [], []
    for entry in entries:
        week_rows = reader.load(release_directory, weeks=[entry.week])
        sessions.append(week_rows.sessions.assign(week=entry.week))
        requests.append(week_rows.requests.assign(week=entry.week))
        tool_calls.append(week_rows.tool_calls.assign(week=entry.week))
    return WeekTaggedRelease(
        requests=pandas.concat(requests, ignore_index=True),
        sessions=pandas.concat(sessions, ignore_index=True),
        tool_calls=pandas.concat(tool_calls, ignore_index=True),
    )


def integer_columns(table_schema: pyarrow.Schema) -> list[str]:
    """The integer columns of a release table, named as the reader names them: a struct's fields as `struct.field`."""
    names = []
    for field in table_schema:
        if pyarrow.types.is_struct(field.type):
            for subfield in field.type:
                if pyarrow.types.is_integer(subfield.type):
                    names.append(f"{field.name}.{subfield.name}")
        elif pyarrow.types.is_integer(field.type):
            names.append(field.name)
    return names


def with_nullable_integers(frame: pandas.DataFrame, table_schema: pyarrow.Schema) -> pandas.DataFrame:
    """The frame with each integer column of the release table that arrived as float, because it holds nulls, as
    `Int64`."""
    restored = {}
    for name in integer_columns(table_schema):
        if name in frame.columns and pandas.api.types.is_float_dtype(frame[name]):
            restored[name] = "Int64"
    return frame.astype(restored)
