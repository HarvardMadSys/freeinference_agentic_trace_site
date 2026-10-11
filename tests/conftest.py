"""Fixtures shared by the tests: the site's data folder built once from the fixture release, its weeks, and a database
over it; and for the paper-parity modules, the paper's numbers and the full site data with the paper's harnesses
selected."""

import collections.abc
import json
import pathlib

import duckdb
import pytest

import site_data.__main__

import fixture_release
import site_database
import test_paper_parity


@pytest.fixture(scope="session")
def data_directory(tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
    """The site's data folder, built once from the fixture release."""
    root = tmp_path_factory.mktemp("site")
    fixture_release.write_fixture_release(root / "release", root / "simulation")
    site_data.__main__.main(["--release", str(root / "release"), "--simulation", str(root / "simulation"),
                             "--out", str(root / "data")])
    return root / "data"


@pytest.fixture(scope="session")
def fixture_weeks(data_directory: pathlib.Path) -> list[str]:
    """The Sunday of every week in the data folder's `weeks.json`, oldest first."""
    entries = json.loads((data_directory / "weeks.json").read_text())
    return [entry["week"] for entry in entries]


@pytest.fixture
def connection(data_directory: pathlib.Path) -> collections.abc.Iterator[duckdb.DuckDBPyConnection]:
    """A fresh database over the fixture's data folder, with empty selection tables."""
    database = site_database.open_site_database(data_directory)
    yield database
    database.close()


@pytest.fixture(scope="session")
def paper_numbers() -> dict:
    """The paper's `numbers.json`: section, then item, then name; skips when it or the full site data is missing."""
    test_paper_parity.skip_unless_inputs_exist()
    return json.loads(test_paper_parity.numbers_file().read_text())


@pytest.fixture(scope="session")
def agentic() -> collections.abc.Iterator[duckdb.DuckDBPyConnection]:
    """The full site data with every week and the paper's harnesses, every one but the benchmark's, selected."""
    connection = test_paper_parity.selected_database(benchmark=False)
    yield connection
    connection.close()
