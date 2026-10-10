"""Fixtures shared by the tests: the site's data folder built once from the fixture release, and its weeks."""

import json
import pathlib

import pytest

import site_data.__main__

import fixture_release


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
