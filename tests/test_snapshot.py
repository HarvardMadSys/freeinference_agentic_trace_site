"""The snapshot test's comparison report: a unit whose text changed, one that is new, and one no longer shown, each
named by its path in the snapshots folder; and nothing for files that match."""

import pathlib

import pytest

pytest.importorskip("playwright.sync_api")  # the snapshot module drives the browser; without Playwright it is skipped

import snapshot


def kept_snapshots(folder: pathlib.Path) -> None:
    """A snapshots folder of one state with two units."""
    (folder / "explore-sessions").mkdir(parents=True)
    (folder / "explore-sessions" / "stats.txt").write_text("16 weeks\n12,002 sessions\n")
    (folder / "explore-sessions" / "hero.txt").write_text("FreeInference Agentic Dataset\n")


def test_matching_files_report_nothing(tmp_path: pathlib.Path) -> None:
    kept_snapshots(tmp_path)
    shown = {
        tmp_path / "explore-sessions" / "stats.txt": "16 weeks\n12,002 sessions\n",
        tmp_path / "explore-sessions" / "hero.txt": "FreeInference Agentic Dataset\n",
    }
    assert snapshot.changed_units(shown, tmp_path) == []


def test_changed_new_and_no_longer_shown_units_are_named(tmp_path: pathlib.Path) -> None:
    kept_snapshots(tmp_path)
    shown = {
        tmp_path / "explore-sessions" / "stats.txt": "17 weeks\n12,002 sessions\n",
        tmp_path / "explore-sessions" / "team.txt": "William Nixon\n",
    }
    assert snapshot.changed_units(shown, tmp_path) == [
        "changed: explore-sessions/stats.txt\n    @@ -1 +1 @@\n    -16 weeks\n    +17 weeks",
        "new: explore-sessions/team.txt",
        "no longer shown: explore-sessions/hero.txt",
    ]
