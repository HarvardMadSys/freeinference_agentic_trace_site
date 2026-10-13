"""The session buckets the data step writes for the fixture: a top-level session's rows are its bucket queries' rows,
a subagent's id finds its top-level session through the week's index, every prefix a session id starts with has a file, every week has its index,
and a rebuild writes the same bytes."""

import gzip
import json
import pathlib
import shutil

import duckdb
import pytest

import site_data.__main__
import site_data.answers
import site_data.buckets
import site_data.check_answers
import site_data.paths

import fixture_release
import site_database

FIRST_SUNDAY = fixture_release.FIRST_WEEK.split("_")[0]  # a week folder is named `<sunday>_<saturday>`
SECOND_SUNDAY = fixture_release.SECOND_WEEK.split("_")[0]
TREE_ROOT = "tree-root"  # the fixture's first-week top-level session with a tree of subagents
TREE_SUBAGENTS = ["tree-child", "tree-sibling", "tree-grandchild"]  # its subagents, the last one two levels down
PARTS = ["tree", "requests", "tool_calls"]  # the parts of a top-level session's entry, in the order they are written


def read_gzipped_json(path: pathlib.Path) -> dict:
    """The JSON value of a gzipped file."""
    return json.loads(gzip.decompress(path.read_bytes()))


def bucket_of(data_directory: pathlib.Path, week: str, session_id: str) -> dict:
    """The bucket of the week that holds the top-level session `session_id`."""
    prefix = session_id[:site_data.buckets.PREFIX_LENGTH]
    return read_gzipped_json(data_directory / site_data.paths.bucket_file(week, prefix))


def written_buckets(data_directory: pathlib.Path) -> list[str]:
    """Every file under the buckets folder, by its path relative to the data folder, sorted."""
    folder = data_directory / site_data.paths.SESSION_BUCKETS_FOLDER
    return sorted(path.relative_to(data_directory).as_posix() for path in folder.rglob("*") if path.is_file())


def live_rows(connection: duckdb.DuckDBPyConnection, week: str, part: str, root: str) -> list[list]:
    """The rows the part's bucket query returns for the top-level session `root` of `week`, in its order, without the
    root column, its first, as JSON reads them back."""
    site_database.select_weeks(connection, [week], fixture_release.EVERY_HARNESS)
    result = connection.execute(site_database.statement_text(site_data.buckets.BUCKET_PARTS[part]))
    session_rows = []
    for row in result.fetchall():
        if row[0] == root:
            session_rows.append(list(row[1:]))
    return json.loads(json.dumps(session_rows))


@pytest.mark.parametrize("part", PARTS)
def test_a_bucket_s_rows_are_its_query_s_rows_for_the_top_level_session(
        connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path, part: str) -> None:
    entry = bucket_of(data_directory, FIRST_SUNDAY, TREE_ROOT)[TREE_ROOT]
    assert list(entry) == PARTS
    query_text = site_database.statement_text(site_data.buckets.BUCKET_PARTS[part])
    columns = [column[0] for column in connection.execute(query_text).description]
    assert entry[part]["columns"] == columns[1:]
    assert entry[part]["rows"] == live_rows(connection, FIRST_SUNDAY, part, TREE_ROOT)


# `tree-root` 5 requests, `tree-child` 2, `tree-sibling` 2 and `tree-grandchild` 1, with 5, 2, 2 and 0 tool calls.
def test_a_bucket_holds_the_whole_tree_with_its_subagents_rows(data_directory: pathlib.Path) -> None:
    entry = bucket_of(data_directory, FIRST_SUNDAY, TREE_ROOT)[TREE_ROOT]
    tree_ids = [row[0] for row in entry["tree"]["rows"]]
    assert tree_ids == [TREE_ROOT, "tree-child", "tree-sibling", "tree-grandchild"]
    assert [row[entry["tree"]["columns"].index("depth")] for row in entry["tree"]["rows"]] == [0, 1, 1, 2]
    request_ids = [row[0] for row in entry["requests"]["rows"]]
    assert {session: request_ids.count(session) for session in tree_ids} == {
        "tree-root": 5, "tree-child": 2, "tree-sibling": 2, "tree-grandchild": 1}
    call_ids = [row[0] for row in entry["tool_calls"]["rows"]]
    assert {session: call_ids.count(session) for session in tree_ids} == {
        "tree-root": 5, "tree-child": 2, "tree-sibling": 2, "tree-grandchild": 0}


def test_a_value_is_kept_as_the_frame_holds_it(data_directory: pathlib.Path) -> None:
    entry = bucket_of(data_directory, FIRST_SUNDAY, TREE_ROOT)[TREE_ROOT]
    requests = [dict(zip(entry["requests"]["columns"], row)) for row in entry["requests"]["rows"]]
    root_requests = [request for request in requests if request["session_id"] == TREE_ROOT]
    assert root_requests[0]["start_ms"] == 1_780_186_600_000  # milliseconds, an integer
    assert root_requests[3]["ttft_ms"] is None  # a missing number is null
    calls = [dict(zip(entry["tool_calls"]["columns"], row)) for row in entry["tool_calls"]["rows"]]
    programs = [call["programs"] for call in calls if call["name"] == "bash"]
    assert programs[0] == ["cd", "pytest"]  # a list of strings


@pytest.mark.parametrize("subagent", TREE_SUBAGENTS)
def test_a_subagent_s_id_resolves_to_its_top_level_session_through_the_index(data_directory: pathlib.Path,
                                                                              subagent: str) -> None:
    index = read_gzipped_json(data_directory / site_data.paths.bucket_index_file(FIRST_SUNDAY))
    assert index[subagent] == TREE_ROOT
    assert subagent not in bucket_of(data_directory, FIRST_SUNDAY, subagent)
    tree_ids = [row[0] for row in bucket_of(data_directory, FIRST_SUNDAY, TREE_ROOT)[TREE_ROOT]["tree"]["rows"]]
    assert subagent in tree_ids


def test_the_index_maps_every_session_of_the_week_and_only_them(data_directory: pathlib.Path) -> None:
    for sunday, folder in [(FIRST_SUNDAY, fixture_release.FIRST_WEEK), (SECOND_SUNDAY, fixture_release.SECOND_WEEK)]:
        index = read_gzipped_json(data_directory / site_data.paths.bucket_index_file(sunday))
        week_ids = [session.session_id for session in fixture_release.SESSIONS if session.week == folder]
        assert sorted(index) == sorted(week_ids)
        assert list(index) == sorted(index)


def test_every_top_level_session_has_one_bucket_entry_and_every_prefix_in_use_a_file(data_directory: pathlib.Path) -> None:
    expected_files = []
    for sunday, folder in [(FIRST_SUNDAY, fixture_release.FIRST_WEEK), (SECOND_SUNDAY, fixture_release.SECOND_WEEK)]:
        roots, every_id = [], []
        for session in fixture_release.SESSIONS:
            if session.week == folder:
                every_id.append(session.session_id)
                if session.parent_session_id is None:
                    roots.append(session.session_id)
        expected_files.append(site_data.paths.bucket_index_file(sunday))
        for prefix in sorted(set(session_id[:site_data.buckets.PREFIX_LENGTH] for session_id in every_id)):
            expected_files.append(site_data.paths.bucket_file(sunday, prefix))
            bucket = bucket_of(data_directory, sunday, prefix)
            assert sorted(bucket) == sorted(root for root in roots if root.startswith(prefix))
            assert list(bucket) == sorted(bucket)
    assert written_buckets(data_directory) == sorted(expected_files)


def test_no_week_in_weeks_json_lacks_its_index(data_directory: pathlib.Path, fixture_weeks: list[str]) -> None:
    assert fixture_weeks == [FIRST_SUNDAY, SECOND_SUNDAY]
    for week in fixture_weeks:
        assert (data_directory / site_data.paths.bucket_index_file(week)).is_file(), week


def test_a_bucket_is_gzipped_with_no_time_in_its_header(data_directory: pathlib.Path) -> None:
    for name in written_buckets(data_directory):
        header = (data_directory / name).read_bytes()[:8]
        assert header[:2] == b"\x1f\x8b", name  # gzip's magic number
        assert header[4:8] == b"\x00\x00\x00\x00", name  # the modification time, 0


def test_a_rebuild_writes_identical_buckets(connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path,
                                           tmp_path: pathlib.Path) -> None:
    data = tmp_path / "data"
    shutil.copytree(data_directory, data)
    site_data.buckets.write_buckets(connection, data)
    before = {name: (data_directory / name).read_bytes() for name in written_buckets(data_directory)}
    after = {name: (data / name).read_bytes() for name in written_buckets(data)}
    assert after == before


def test_the_bucket_queries_are_every_query_of_their_folder_and_are_hashed() -> None:
    on_disk = sorted(f"buckets/{path.stem}" for path in (site_database.QUERIES_FOLDER / "buckets").glob("*.sql"))
    assert sorted(site_data.buckets.BUCKET_PARTS.values()) == on_disk
    assert set(on_disk) <= set(site_data.answers.query_hashes())


def test_a_bucket_query_edited_since_make_data_fails_the_check(data_directory: pathlib.Path,
                                                               tmp_path: pathlib.Path) -> None:
    queries = tmp_path / "queries"
    shutil.copytree(site_database.QUERIES_FOLDER, queries)
    with (queries / "buckets" / "week_requests.sql").open("a") as query:
        query.write("-- edited\n")
    stale = site_data.check_answers.stale_queries(data_directory, queries)
    assert [query.name for query in stale] == ["buckets/week_requests"]
