"""Where each session sits in its tree of subagents.

A session's root is the top-level session reached by following
`parent_session_id` until a session has none; its depth is the number of
links followed: 0 for a top-level session, 1 for its subagents, and so on.
"""

import typing

import pandas


class TreePosition(typing.NamedTuple):
    """A session's top-level session and its depth below it."""

    root_session_id: str
    depth: int


def tree_positions(sessions: pandas.DataFrame) -> pandas.DataFrame:
    """Per session: `session_id`, `root_session_id` and `depth`; every parent must be one of the sessions."""
    parents = {}
    for session_id, parent_session_id in zip(sessions.session_id, sessions.parent_session_id):
        parents[session_id] = None if pandas.isna(parent_session_id) else parent_session_id
    positions = [tree_position(session_id, parents) for session_id in sessions.session_id]
    return pandas.DataFrame({
        "session_id": sessions.session_id.to_numpy(),
        "root_session_id": [position.root_session_id for position in positions],
        "depth": [position.depth for position in positions],
    })


def tree_position(session_id: str, parents: dict[str, str | None]) -> TreePosition:
    """The session's root and depth, found by following its parents."""
    root, depth = session_id, 0
    while parents[root] is not None:
        parent = parents[root]
        if parent not in parents:
            raise ValueError(f"session {root}'s parent {parent} is not in the release")
        if depth >= len(parents):
            raise ValueError(f"the parents of session {session_id} form a cycle")
        root, depth = parent, depth + 1
    return TreePosition(root, depth)
