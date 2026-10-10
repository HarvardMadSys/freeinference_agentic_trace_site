"""The data step on the fixture release: what it writes, in what order, and that a corrupted week stops it."""

import pathlib

import pandas
import pytest
from pyarrow import parquet
from release import reader

import site_data.__main__

import fixture_release

PARQUET_FILES = ["requests.parquet", "tool_calls.parquet", "sessions.parquet", "simulation.parquet"]
REQUEST_COLUMNS = [
    "week", "session_id", "step", "start_ms", "end_ms", "ttft_ms", "model", "provider", "step_trigger",
    "waited_for", "prompt_tokens", "completion_tokens", "cache_read_tokens", "system_tokens", "user_tokens",
    "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason", "transition",
    "cause", "scope", "is_top_level", "root_session_id", "depth", "turn", "uncached_tokens", "hit_ratio", "wait_s",
    "idle_gap_s", "idle_gap_bin", "is_trusted_ttft", "n_tool_calls",
]


def build(tmp_path: pathlib.Path, out_name: str = "out") -> pathlib.Path:
    """Run the data step on the fixture release written under tmp_path, into tmp_path / out_name."""
    if not (tmp_path / "release").exists():
        fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    out = tmp_path / out_name
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(out)])
    return out


def test_every_file_is_written_and_its_rows_printed(tmp_path: pathlib.Path, capsys: pytest.CaptureFixture) -> None:
    out = build(tmp_path)
    assert sorted(path.name for path in out.iterdir()) == sorted([*PARQUET_FILES, "weeks.json"])
    printed = capsys.readouterr().out.splitlines()
    assert [line.split(":")[0] for line in printed] == [*PARQUET_FILES, "weeks.json"]
    assert printed[0].startswith("requests.parquet: 21 rows, ")
    assert printed[-1].startswith("weeks.json: 2 rows, ")


def test_two_runs_write_identical_files(tmp_path: pathlib.Path) -> None:
    first, second = build(tmp_path, "first"), build(tmp_path, "second")
    for file_name in [*PARQUET_FILES, "weeks.json"]:
        assert (first / file_name).read_bytes() == (second / file_name).read_bytes(), file_name


def test_a_corrupted_week_stops_the_run_before_anything_is_written(tmp_path: pathlib.Path) -> None:
    fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    table_path = tmp_path / "release" / "2026-06-07_2026-06-13" / "requests.parquet"
    contents = bytearray(table_path.read_bytes())
    contents[len(contents) // 2] ^= 0xFF
    table_path.write_bytes(bytes(contents))
    (tmp_path / "out").mkdir()
    with pytest.raises(reader.ReleaseError, match="2026-06-07_2026-06-13/requests.parquet differs"):
        build(tmp_path)
    assert list((tmp_path / "out").iterdir()) == []


def test_each_row_group_holds_one_week(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    for file_name in PARQUET_FILES:
        metadata = parquet.ParquetFile(out / file_name).metadata
        week_column = metadata.schema.names.index("week")
        for group in range(metadata.num_row_groups):
            statistics = metadata.row_group(group).column(week_column).statistics
            assert statistics.min == statistics.max, (file_name, group)
    assert parquet.ParquetFile(out / "requests.parquet").metadata.num_row_groups == 2


def test_requests_are_written_with_the_spec_s_columns_in_tree_order(tmp_path: pathlib.Path) -> None:
    written = pandas.read_parquet(build(tmp_path) / "requests.parquet")
    assert list(written.columns) == REQUEST_COLUMNS
    first_week = written[written.week == "2026-05-31"]
    assert first_week.session_id.tolist()[:4] == ["idle-week-1"] * 3 + ["swe-bench"]
    tree = first_week[first_week.root_session_id == "tree-root"]
    assert tree.session_id.drop_duplicates().tolist() == ["tree-child", "tree-grandchild", "tree-root", "tree-sibling"]


def test_nullable_integers_and_booleans_keep_their_types(tmp_path: pathlib.Path) -> None:
    schema = parquet.read_schema(build(tmp_path) / "requests.parquet")
    assert str(schema.field("ttft_ms").type) == "int64" and str(schema.field("idle_gap_bin").type) == "int64"
    assert str(schema.field("is_top_level").type) == "bool"
    written = pandas.read_parquet(tmp_path / "out" / "requests.parquet")
    assert written.ttft_ms.dtype == "Int64" and written.ttft_ms.isna().sum() == 1
