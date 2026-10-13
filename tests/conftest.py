"""Fixtures shared by the tests: the fixture release written once, the site's data folder built from it, its weeks,
its four frames and a database over them; and for the paper-parity modules, the paper's numbers."""

import collections.abc
import json
import pathlib

import duckdb
import pytest

import site_data.__main__
import site_data.harnesses
import site_data.loading
import site_data.site_database
import site_data.weeks

import fixture_release
import site_database
import test_paper_parity


@pytest.fixture(scope="session")
def fixture_folders(tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
    """A folder holding the fixture release, `release/`, and its simulation, `simulation/`, written once."""
    root = tmp_path_factory.mktemp("fixture")
    fixture_release.write_fixture_release(root / "release", root / "simulation")
    return root


@pytest.fixture(scope="session")
def data_directory(fixture_folders: pathlib.Path, tmp_path_factory: pytest.TempPathFactory) -> pathlib.Path:
    """The site's data folder, built once from the fixture release."""
    out = tmp_path_factory.mktemp("site") / "data"
    site_data.__main__.main(["--release", str(fixture_folders / "release"),
                             "--simulation", str(fixture_folders / "simulation"), "--out", str(out)])
    return out


@pytest.fixture(scope="session")
def fixture_weeks(data_directory: pathlib.Path) -> list[str]:
    """The Sunday of every week in the data folder's `weeks.json`, oldest first."""
    entries = json.loads((data_directory / "weeks.json").read_text())
    return [entry["week"] for entry in entries]


@pytest.fixture(scope="session")
def fixture_frames(fixture_folders: pathlib.Path) -> site_data.site_database.SiteFrames:
    """The site's four frames of the fixture release, built as the data step builds them."""
    release_directory, simulation_directory = fixture_folders / "release", fixture_folders / "simulation"
    entries = site_data.weeks.weeks_index(release_directory, simulation_directory)
    release = site_data.loading.load_release(release_directory, entries)
    return site_data.__main__.site_frames(release, simulation_directory, entries)


@pytest.fixture
def connection(
        fixture_frames: site_data.site_database.SiteFrames) -> collections.abc.Iterator[duckdb.DuckDBPyConnection]:
    """A fresh database over the fixture's frames, with empty selection tables."""
    harness_entries = site_data.harnesses.harnesses_index(fixture_frames.sessions)
    database = site_database.open_site_database(fixture_frames, harness_entries)
    yield database
    database.close()


@pytest.fixture(scope="session")
def paper_numbers() -> dict:
    """The paper's `numbers.json`: section, then item, then name; skips when it or the shipped answers are missing."""
    test_paper_parity.skip_unless_inputs_exist()
    return json.loads(test_paper_parity.numbers_file().read_text())
