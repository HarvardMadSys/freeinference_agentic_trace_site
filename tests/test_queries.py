"""Every query of the site, run as the browser runs it on data built from the fixture release, returns its columns."""

import collections.abc
import json
import pathlib

import duckdb
import pytest

import site_data.__main__

import fixture_release
import site_database

# The columns each query returns, in order, by the query's name. Every query file outside `setup/` has an entry.
EXPECTED_COLUMNS = {
    "explore/request_count": ["requests"],
}

# The `?` parameters of the queries that take them, in order, by the query's name.
QUERY_PARAMETERS: dict[str, list] = {}

SCOPES = ["Agentic", "SWE-Bench"]  # every scope of the data; the scope "All" selects both
SESSION_QUERIES_FOLDER = "session/"  # queries of the Session page, which read the selected session
SELECTED_SESSION = "tree-root"  # the fixture's session with a tree of subagents
SELECTED_SESSION_WEEK = fixture_release.FIRST_WEEK.split("_")[0]  # its week's Sunday


@pytest.fixture(scope="session")
def data_directory(tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
    """The site's data folder, built once from the fixture release."""
    root = tmp_path_factory.mktemp("site")
    fixture_release.write_fixture_release(root / "release", root / "simulation")
    site_data.__main__.main(["--release", str(root / "release"), "--simulation", str(root / "simulation"),
                             "--out", str(root / "data")])
    return root / "data"


@pytest.fixture
def connection(data_directory: pathlib.Path) -> collections.abc.Iterator[duckdb.DuckDBPyConnection]:
    """A fresh database over the fixture's data folder, with empty selection tables."""
    database = site_database.open_site_database(data_directory)
    yield database
    database.close()


def fixture_weeks(data_directory: pathlib.Path) -> list[str]:
    """The Sunday of every week in the data folder's `weeks.json`, oldest first."""
    entries = json.loads((data_directory / "weeks.json").read_text())
    return [entry["week"] for entry in entries]


def test_the_fixture_has_two_weeks(data_directory: pathlib.Path) -> None:
    assert fixture_weeks(data_directory) == ["2026-05-31", "2026-06-07"]


@pytest.mark.parametrize("name", sorted(EXPECTED_COLUMNS))
def test_a_query_returns_its_columns(connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path,
                                     name: str) -> None:
    site_database.select_weeks(connection, fixture_weeks(data_directory), SCOPES)
    if name.startswith(SESSION_QUERIES_FOLDER):
        site_database.select_session(connection, SELECTED_SESSION_WEEK, SELECTED_SESSION)
    rows = site_database.run_query(connection, name, QUERY_PARAMETERS.get(name))
    assert list(rows.columns) == EXPECTED_COLUMNS[name]


def test_every_query_file_has_its_columns_listed_and_every_listed_query_has_a_file() -> None:
    assert sorted(EXPECTED_COLUMNS) == site_database.query_names()


def test_every_parameterised_query_is_listed() -> None:
    for name in QUERY_PARAMETERS:
        assert name in EXPECTED_COLUMNS, name


def test_every_query_file_starts_with_a_comment() -> None:
    for path in sorted(site_database.QUERIES_FOLDER.rglob("*.sql")):
        first_line = path.read_text().splitlines()[0]
        assert first_line.startswith("--"), f"{path.relative_to(site_database.QUERIES_FOLDER)} starts with {first_line!r}"


# Top-level requests of the fixture, counted by hand from `fixture_release.REQUESTS`: in the Agentic scope
# `tree-root` 5, `idle-week-1` 3, `mutation` 3 and `idle-week-2` 2; in the SWE-Bench scope `swe-bench` 2 and
# `idle-benchmark` 1. The subagents `tree-child`, `tree-sibling` and `tree-grandchild` are not top-level.
@pytest.mark.parametrize(("scopes", "top_level_requests"), [
    (["Agentic"], 13),
    (["SWE-Bench"], 3),
    (SCOPES, 16),
])
def test_the_request_count_is_the_number_of_top_level_requests(connection: duckdb.DuckDBPyConnection,
                                                               data_directory: pathlib.Path, scopes: list[str],
                                                               top_level_requests: int) -> None:
    site_database.select_weeks(connection, fixture_weeks(data_directory), scopes)
    rows = site_database.run_query(connection, "explore/request_count")
    assert rows.requests.tolist() == [top_level_requests]


def test_a_new_selection_replaces_the_previous_one(connection: duckdb.DuckDBPyConnection,
                                                   data_directory: pathlib.Path) -> None:
    site_database.select_weeks(connection, fixture_weeks(data_directory), SCOPES)
    site_database.select_weeks(connection, [SELECTED_SESSION_WEEK], ["Agentic"])
    rows = site_database.run_query(connection, "explore/request_count")
    assert rows.requests.tolist() == [8]  # `tree-root` 5 and `idle-week-1` 3, the first week's Agentic sessions


def test_a_new_session_replaces_the_previous_one(connection: duckdb.DuckDBPyConnection) -> None:
    site_database.select_session(connection, fixture_release.SECOND_WEEK.split("_")[0], "mutation")
    site_database.select_session(connection, SELECTED_SESSION_WEEK, SELECTED_SESSION)
    assert connection.table("selected_session").fetchall() == [(SELECTED_SESSION_WEEK, SELECTED_SESSION)]
