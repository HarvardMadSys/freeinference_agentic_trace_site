"""The data step on the fixture release: what it writes, in what order, and that a corrupted week stops it."""

import json
import pathlib

import pytest

import site_data.__main__
import site_data.answers
import site_data.paths

import fixture_release

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
INDEX_FILES = ["harnesses.json", "weeks.json"]  # written first, in this order
# The session buckets of each week, by the first two characters of its top-level sessions' ids, and its index: the
# first week's `idle-week-1`, `swe-bench` and `tree-root`, the second's `idle-week-2`, `idle-benchmark` and `mutation`.
BUCKET_FILES = [
    f"session_buckets/{FIRST_SUNDAY}/id.json.gz", f"session_buckets/{FIRST_SUNDAY}/sw.json.gz",
    f"session_buckets/{FIRST_SUNDAY}/tr.json.gz", f"session_buckets/{FIRST_SUNDAY}/index.json.gz",
    f"session_buckets/{SECOND_SUNDAY}/id.json.gz", f"session_buckets/{SECOND_SUNDAY}/mu.json.gz",
    f"session_buckets/{SECOND_SUNDAY}/index.json.gz",
]


def build(tmp_path: pathlib.Path, out_name: str = "out") -> pathlib.Path:
    """Run the data step on the fixture release written under tmp_path, into tmp_path / out_name."""
    if not (tmp_path / "release").exists():
        fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    out = tmp_path / out_name
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(out)])
    return out


def written_files(out: pathlib.Path) -> list[str]:
    """Every file under `out`, by its path relative to `out`, sorted."""
    return sorted(path.relative_to(out).as_posix() for path in out.rglob("*") if path.is_file())


def answer_files() -> list[str]:
    """The answer file of every answered query, relative to the data folder."""
    return [site_data.paths.answer_file(name) for name in site_data.answers.answered_query_names()]


def test_the_indexes_every_answer_and_every_bucket_are_written_and_no_row_file(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    hashes_file = f"{site_data.paths.ANSWERS_FOLDER}/{site_data.paths.QUERY_HASHES_FILE}"
    assert written_files(out) == sorted([*INDEX_FILES, *answer_files(), hashes_file, *BUCKET_FILES])
    assert list(out.rglob("*.parquet")) == []


def test_each_index_the_answers_and_the_buckets_are_printed(tmp_path: pathlib.Path,
                                                            capsys: pytest.CaptureFixture) -> None:
    build(tmp_path)
    printed = capsys.readouterr().out.splitlines()
    assert [line.split(":")[0] for line in printed] == [*INDEX_FILES, site_data.paths.ANSWERS_FOLDER,
                                                        site_data.paths.SESSION_BUCKETS_FOLDER]
    assert printed[0].startswith("harnesses.json: 4 rows, ")
    assert printed[1].startswith("weeks.json: 2 rows, ")
    assert printed[2].startswith(f"{site_data.paths.ANSWERS_FOLDER}: {len(answer_files())} files, ")
    assert printed[3].startswith(f"{site_data.paths.SESSION_BUCKETS_FOLDER}: 5 buckets and 2 indexes, ")


def mark_first_week_simulated_from_older_traces(tmp_path: pathlib.Path) -> None:
    """Record in the first week's `sources.json` a manifest sha256 that is not its current manifest's."""
    sources_path = tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json"
    sources = json.loads(sources_path.read_text())
    for file_name in sources:
        sources[file_name] = {"manifest.json": "0" * 64}
    sources_path.write_text(json.dumps(sources))


def test_a_week_simulated_from_older_traces_is_published_as_not_simulated(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    assert [entry["simulated"] for entry in json.loads((out / "weeks.json").read_text())] == [True, False]
    mark_first_week_simulated_from_older_traces(tmp_path)
    build(tmp_path)  # into the same folder
    assert [entry["simulated"] for entry in json.loads((out / "weeks.json").read_text())] == [False, False]


def test_two_runs_write_identical_files(tmp_path: pathlib.Path) -> None:
    first, second = build(tmp_path, "first"), build(tmp_path, "second")
    assert written_files(first) == written_files(second)
    for name in written_files(first):
        assert (first / name).read_bytes() == (second / name).read_bytes(), name


def test_a_corrupted_week_stops_the_run_before_anything_is_written(tmp_path: pathlib.Path,
                                                                   capsys: pytest.CaptureFixture) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    table_path = tmp_path / "release" / "2026-06-07_2026-06-13" / "requests.parquet"
    contents = bytearray(table_path.read_bytes())
    contents[len(contents) // 2] ^= 0xFF
    table_path.write_bytes(bytes(contents))
    (tmp_path / "out").mkdir()
    with pytest.raises(SystemExit) as stop:
        build(tmp_path)
    assert stop.value.code == 1
    assert "2026-06-07_2026-06-13/requests.parquet differs" in capsys.readouterr().err
    assert list((tmp_path / "out").iterdir()) == []
