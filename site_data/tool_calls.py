"""The site's tool calls: one row per tool call of every session, subagents included.

It keeps the release's call columns but `programs`, `parse_status` and
`arguments_skeleton`, and takes from the call's request, in the site's
requests, its `scope`, `is_top_level` and `root_session_id`. A call joins its
request on `week`, `session_id` and `step`.
"""

import pandas

from release import schema
from site_data import loading

REQUEST_KEY = ["week", "session_id", "step"]  # the columns a call shares with the request whose response made it
# The frame's columns in order.
COLUMNS = [
    "week", "session_id", "step", "call_index", "name", "category", "outcome", "result_tokens", "latency_ms", "scope",
    "is_top_level", "root_session_id",
]


def tool_calls_frame(release: loading.WeekTaggedRelease, requests: pandas.DataFrame) -> pandas.DataFrame:
    """The site's tool calls, in week, session, step and call order; every call must join exactly one request."""
    request_columns = requests[[*REQUEST_KEY, "scope", "is_top_level", "root_session_id"]]
    calls = release.tool_calls.merge(
        request_columns, on=REQUEST_KEY, how="left", validate="many_to_one", indicator="joined")
    unjoined = calls[calls.joined == "left_only"]
    if len(unjoined) > 0:
        first = unjoined.iloc[0]
        raise ValueError(f"{len(unjoined)} tool calls join no request, the first at step {first.step} of session "
                         f"{first.session_id} in the week of {first.week}")
    calls = loading.with_nullable_integers(calls, schema.TOOL_CALLS_SCHEMA)
    return calls.sort_values([*REQUEST_KEY, "call_index"], ignore_index=True)[COLUMNS]
