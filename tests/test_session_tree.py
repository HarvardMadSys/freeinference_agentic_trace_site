"""A session's root and depth come from following its parents."""

import pandas
import pytest

from site_data import session_tree


def sessions(parents: dict[str, str | None]) -> pandas.DataFrame:
    """A sessions frame with the given parent of each session."""
    return pandas.DataFrame({"session_id": list(parents), "parent_session_id": list(parents.values())})


def test_each_session_finds_its_root_and_depth() -> None:
    positions = session_tree.tree_positions(sessions({"root": None, "child": "root", "grandchild": "child"}))
    assert positions.to_dict("records") == [
        {"session_id": "root", "root_session_id": "root", "depth": 0},
        {"session_id": "child", "root_session_id": "root", "depth": 1},
        {"session_id": "grandchild", "root_session_id": "root", "depth": 2},
    ]


def test_a_parent_missing_from_the_release_is_named() -> None:
    with pytest.raises(ValueError, match="parent elsewhere is not in the release"):
        session_tree.tree_positions(sessions({"child": "elsewhere"}))


def test_parents_that_form_a_cycle_are_refused() -> None:
    with pytest.raises(ValueError, match="form a cycle"):
        session_tree.tree_positions(sessions({"first": "second", "second": "first"}))
