"""The data step on the fixture release: what it writes, in what order, and that a corrupted week stops it."""

import json
import pathlib

import pandas
import pyarrow
import pytest
from pyarrow import parquet

import site_data.__main__
import site_data.answers
import site_data.paths

import fixture_release

KIND_FOLDERS = ["requests", "tool_calls", "sessions", "simulation"]  # in the order the step writes them
INDEX_FILES = ["harnesses.json", "weeks.json"]  # written after the kinds' files, in this order
FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
REQUEST_COLUMNS = [
    "session_id", "step", "start_ms", "end_ms", "ttft_ms", "model", "provider", "step_trigger",
    "waited_for", "prompt_tokens", "completion_tokens", "cache_read_tokens", "system_tokens", "user_tokens",
    "assistant_tokens", "tool_tokens", "tool_definition_tokens", "n_messages", "finish_reason", "transition",
    "cause", "harness", "is_top_level", "root_session_id", "depth", "turn", "uncached_tokens", "hit_ratio", "wait_s",
    "idle_gap_s", "idle_gap_bin", "is_trusted_ttft", "n_tool_calls", "user_prompt_tokens", "missed_tokens_no_ttl",
]


def build(tmp_path: pathlib.Path, out_name: str = "out") -> pathlib.Path:
    """Run the data step on the fixture release written under tmp_path, into tmp_path / out_name."""
    if not (tmp_path / "release").exists():
        fixture_release.write_fixture_release(tmp_path / "release", tmp_path / "simulation")
    out = tmp_path / out_name
    site_data.__main__.main(["--release", str(tmp_path / "release"), "--simulation", str(tmp_path / "simulation"),
                             "--out", str(out)])
    return out


def week_file(out: pathlib.Path, kind_folder: str, week: str) -> pathlib.Path:
    """The path of one week's file of a kind in the data folder `out`."""
    return out / kind_folder / f"week={week}" / "rows.parquet"


def written_files(out: pathlib.Path) -> list[str]:
    """Every file under `out`, by its path relative to `out`, sorted."""
    return sorted(path.relative_to(out).as_posix() for path in out.rglob("*") if path.is_file())


def answer_files() -> list[str]:
    """The answer file of every answered query, relative to the data folder."""
    return [site_data.paths.answer_file(name) for name in site_data.answers.answered_query_names()]


def test_every_week_s_file_of_every_kind_and_every_answer_is_written(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    hashes_file = f"{site_data.paths.ANSWERS_FOLDER}/{site_data.paths.QUERY_HASHES_FILE}"
    expected = [*INDEX_FILES, *answer_files(), hashes_file]
    for kind_folder in KIND_FOLDERS:
        for week in [FIRST_SUNDAY, SECOND_SUNDAY]:
            if kind_folder != "simulation" or week == FIRST_SUNDAY:  # the second week is not simulated
                expected.append(week_file(out, kind_folder, week).relative_to(out).as_posix())
    assert written_files(out) == sorted(expected)


def test_each_kind_s_rows_over_every_week_are_printed(tmp_path: pathlib.Path, capsys: pytest.CaptureFixture) -> None:
    build(tmp_path)
    printed = capsys.readouterr().out.splitlines()
    assert [line.split(":")[0] for line in printed] == [*KIND_FOLDERS, *INDEX_FILES, site_data.paths.ANSWERS_FOLDER]
    assert printed[0].startswith("requests: 21 rows, ")
    assert printed[1].startswith("tool_calls: 16 rows, ")
    assert printed[2].startswith("sessions: 9 rows, ")
    assert printed[3].startswith("simulation: 4 rows, ")
    assert printed[-2].startswith("weeks.json: 2 rows, ")
    assert printed[-1].startswith(f"{site_data.paths.ANSWERS_FOLDER}: {len(answer_files())} files, ")


def mark_first_week_simulated_from_older_traces(tmp_path: pathlib.Path) -> None:
    """Record in the first week's `sources.json` a manifest sha256 that is not its current manifest's."""
    sources_path = tmp_path / "simulation" / fixture_release.SIMULATED_WEEK / "sources.json"
    sources = json.loads(sources_path.read_text())
    for file_name in sources:
        sources[file_name] = {"manifest.json": "0" * 64}
    sources_path.write_text(json.dumps(sources))


def test_a_week_simulated_from_older_traces_is_published_without_simulation_rows(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    assert [entry["simulated"] for entry in json.loads((out / "weeks.json").read_text())] == [True, False]
    assert len(pandas.read_parquet(week_file(out, "simulation", FIRST_SUNDAY))) == 4
    mark_first_week_simulated_from_older_traces(tmp_path)
    build(tmp_path)  # into the same folder, whose simulation file of the first week is now stale
    assert [entry["simulated"] for entry in json.loads((out / "weeks.json").read_text())] == [False, False]
    assert not (out / "simulation").exists()
    assert week_file(out, "requests", FIRST_SUNDAY).exists()


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


def test_each_week_s_file_holds_that_week_s_rows_only(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    first_week = pandas.read_parquet(week_file(out, "sessions", FIRST_SUNDAY))
    second_week = pandas.read_parquet(week_file(out, "sessions", SECOND_SUNDAY))
    first_week_ids = [session.session_id for session in fixture_release.SESSIONS
                      if session.week == fixture_release.FIRST_WEEK]
    second_week_ids = [session.session_id for session in fixture_release.SESSIONS
                       if session.week == fixture_release.SECOND_WEEK]
    assert sorted(first_week.session_id) == sorted(first_week_ids)
    assert sorted(second_week.session_id) == sorted(second_week_ids)
    second_week_requests = pandas.read_parquet(week_file(out, "requests", SECOND_SUNDAY))
    assert set(second_week_requests.session_id) == set(second_week_ids)


def test_no_file_holds_a_week_column_and_only_the_simulation_s_hold_a_scope(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    for path in out.rglob("*.parquet"):
        names = parquet.read_schema(path).names
        assert "week" not in names, path
        assert ("scope" in names) == (path.parent.parent.name == "simulation"), path


def test_the_simulation_is_written_with_both_scopes_and_without_a_policy(tmp_path: pathlib.Path) -> None:
    written = pandas.read_parquet(week_file(build(tmp_path), "simulation", FIRST_SUNDAY))
    assert "policy" not in written.columns
    assert written[["scope", "ttl", "span_seconds"]].values.tolist() == [
        ["Agentic", "1h", 603_200.0], ["Agentic", "5m", 603_200.0],
        ["SWE-Bench", "1h", 25.0], ["SWE-Bench", "5m", 25.0],
    ]


def test_requests_are_written_with_the_spec_s_columns_in_tree_order(tmp_path: pathlib.Path) -> None:
    written = pandas.read_parquet(week_file(build(tmp_path), "requests", FIRST_SUNDAY))
    assert list(written.columns) == REQUEST_COLUMNS
    assert written.session_id.tolist()[:4] == ["idle-week-1"] * 3 + ["swe-bench"]
    tree = written[written.root_session_id == "tree-root"]
    assert tree.session_id.drop_duplicates().tolist() == ["tree-child", "tree-grandchild", "tree-root", "tree-sibling"]


def test_the_benchmark_session_s_rows_are_written(tmp_path: pathlib.Path) -> None:
    out = build(tmp_path)
    requests = pandas.read_parquet(week_file(out, "requests", FIRST_SUNDAY))
    tool_calls = pandas.read_parquet(week_file(out, "tool_calls", FIRST_SUNDAY))
    sessions = pandas.read_parquet(week_file(out, "sessions", FIRST_SUNDAY))
    assert requests[requests.session_id == "swe-bench"].harness.tolist() == ["eval:swe-bench"] * 2
    assert tool_calls[tool_calls.session_id == "swe-bench"].harness.tolist() == ["eval:swe-bench"] * 2
    assert sessions[sessions.session_id == "swe-bench"].harness.tolist() == ["eval:swe-bench"]


def test_nullable_integers_and_booleans_keep_their_types(tmp_path: pathlib.Path) -> None:
    path = week_file(build(tmp_path), "requests", FIRST_SUNDAY)
    schema = parquet.read_schema(path)
    assert str(schema.field("ttft_ms").type) == "int64" and str(schema.field("idle_gap_bin").type) == "int64"
    assert str(schema.field("user_prompt_tokens").type) == "int64"
    assert str(schema.field("missed_tokens_no_ttl").type) == "int64"
    assert str(schema.field("is_top_level").type) == "bool"
    written = pandas.read_parquet(path)
    assert written.ttft_ms.dtype == "Int64" and written.ttft_ms.isna().sum() == 1


def test_a_call_s_programs_are_written_as_a_list_of_strings(tmp_path: pathlib.Path) -> None:
    path = week_file(build(tmp_path), "tool_calls", FIRST_SUNDAY)
    programs = parquet.read_schema(path).field("programs").type
    assert pyarrow.types.is_list(programs) and pyarrow.types.is_string(programs.value_type)
    written = pandas.read_parquet(path)
    assert list(written.programs[written.name == "bash"].iloc[0]) == ["cd", "pytest"]
