"""Build the site's data folder: `python -m site_data --release <dir> --simulation <dir> --out <dir>`.

Every week is loaded, checked and turned into rows before any file is
written, so a corrupted week stops the run, with its message and exit status
1, and the data folder untouched. Each kind of row is written one file per
week, at `<kind>/week=<sunday>/rows.parquet`, without a `week` column: the
week is the folder's name. A week's file is sorted, here and only here, by
root session, so a session's tree sits together. The indexes `harnesses.json`
and `weeks.json` are written next, then the answers of the default selection,
and last the Session page's buckets, both read back from the files just
written (`site_data/answers.py`, `site_data/buckets.py`).
"""

import argparse
import dataclasses
import pathlib
import shutil
import sys

import pandas
import pyarrow
from pyarrow import parquet

from release import reader
from site_data import answers, buckets, harnesses, loading, paths, requests, sessions, simulation, tool_calls, weeks

ROWS_PER_GROUP = 100_000  # large, so a query makes few ranged reads
COMPRESSION = "zstd"  # small files that DuckDB-WASM reads
BYTES_PER_MB = 1_000_000  # sizes are printed in decimal megabytes, the unit of the host's file size limit
# The row order of each kind's week files: by root session where the rows have one, so a query filtered by session
# reads only the row groups that hold it.
SORT_ORDERS = {
    paths.REQUESTS_FOLDER: ["root_session_id", "session_id", "step"],
    paths.TOOL_CALLS_FOLDER: ["root_session_id", "session_id", "step", "call_index"],
    paths.SESSIONS_FOLDER: ["root_session_id", "session_id"],
    paths.SIMULATION_FOLDER: ["scope", "ttl"],
}


@dataclasses.dataclass(frozen=True)
class WrittenKind:
    """What one kind's week files hold over every week."""

    rows: int
    bytes: int


def main(arguments: list[str] | None = None) -> None:
    """Write each kind's week files, `harnesses.json`, `weeks.json`, the answers and the session buckets into the
    output folder, and print each kind's rows and size over every week, each index's, the answers' files and bytes,
    each query left without an answer, and the buckets' count and size."""
    options = parsed_arguments(arguments)
    try:
        entries = weeks.weeks_index(options.release, options.simulation)
        release = loading.load_release(options.release, entries)
    except reader.ReleaseError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
    frames = site_frames(release, options.simulation, entries)
    del release  # the frames hold every row the files need; the release's own copy is not written
    options.out.mkdir(parents=True, exist_ok=True)
    for kind_folder, frame in frames.items():
        written = write_kind(frame, options.out, kind_folder, weeks.weeks_with_file(entries, kind_folder))
        print(f"{kind_folder}: {written.rows:,} rows, {written.bytes / BYTES_PER_MB:.1f} MB")
    harness_entries = harnesses.harnesses_index(frames[paths.SESSIONS_FOLDER])
    print_size(harnesses.write_harnesses_file(harness_entries, options.out), len(harness_entries))
    print_size(weeks.write_weeks_file(entries, options.out), len(entries))
    written_answers = answers.write_answers(options.out)
    print(f"{paths.ANSWERS_FOLDER}: {written_answers.files} files, {written_answers.bytes:,} bytes")
    for name in written_answers.unanswered:
        print(f"{name}: no answer, because no week is simulated")
    print_buckets(buckets.write_buckets(options.out))


def parsed_arguments(arguments: list[str] | None) -> argparse.Namespace:
    """The release, simulation and output folders named on the command line."""
    parser = argparse.ArgumentParser(prog="python -m site_data", description="Build the site's data folder.")
    parser.add_argument("--release", type=pathlib.Path, required=True, help="the release folder, one folder per week")
    parser.add_argument("--simulation", type=pathlib.Path, required=True, help="the cache simulation's folder")
    parser.add_argument("--out", type=pathlib.Path, required=True, help="the data folder to write")
    return parser.parse_args(arguments)


def site_frames(release: loading.WeekTaggedRelease, simulation_directory: pathlib.Path,
                entries: list[weeks.WeekEntry]) -> dict[str, pandas.DataFrame]:
    """The four frames of the site, each with its `week` column, by the folder each is written to."""
    request_misses = simulation.request_misses_frame(simulation_directory, entries)
    site_requests = requests.requests_frame(release, request_misses)
    return {
        paths.REQUESTS_FOLDER: site_requests,
        paths.TOOL_CALLS_FOLDER: tool_calls.tool_calls_frame(release, site_requests),
        paths.SESSIONS_FOLDER: sessions.sessions_frame(release, site_requests),
        paths.SIMULATION_FOLDER: simulation.simulation_frame(simulation_directory, entries),
    }


def write_kind(frame: pandas.DataFrame, out_directory: pathlib.Path, kind_folder: str,
               week_list: list[str]) -> WrittenKind:
    """Replace the kind's folder with one file per listed week, each holding that week's rows without `week`;
    every row of the frame must belong to a listed week."""
    unlisted_rows = int((~frame.week.isin(week_list)).sum())
    if unlisted_rows:
        raise ValueError(f"{kind_folder} has {unlisted_rows} rows of weeks that have no {kind_folder} file")
    kind_directory = out_directory / kind_folder
    if kind_directory.exists():
        shutil.rmtree(kind_directory)  # a week no longer listed keeps no file
    ordered = frame.sort_values(["week", *SORT_ORDERS[kind_folder]], ignore_index=True)
    # The table is made without `week`, so the schema's pandas metadata lists only the columns the files hold.
    table = pyarrow.Table.from_pandas(ordered.drop(columns=["week"]), preserve_index=False)
    rows, size = 0, 0
    for week in week_list:
        path = out_directory / paths.week_file(kind_folder, week)
        week_rows = table.filter(pyarrow.array(ordered.week == week))
        write_week_file(week_rows, path)
        rows += week_rows.num_rows
        size += path.stat().st_size
    return WrittenKind(rows=rows, bytes=size)


def write_week_file(week_rows: pyarrow.Table, path: pathlib.Path) -> None:
    """Write one week's rows of a kind, in row groups of at most `ROWS_PER_GROUP` rows."""
    path.parent.mkdir(parents=True, exist_ok=True)
    parquet.write_table(week_rows, path, row_group_size=ROWS_PER_GROUP, compression=COMPRESSION)


def print_buckets(written: buckets.WrittenBuckets) -> None:
    """Print the buckets' and indexes' count and size, and the median and largest bucket's size."""
    print(f"{paths.SESSION_BUCKETS_FOLDER}: {written.buckets:,} buckets and {written.indexes} indexes, "
          f"{written.bytes / BYTES_PER_MB:.1f} MB; median bucket {written.median_bucket_bytes:,} bytes, "
          f"largest {written.largest_bucket_bytes:,} bytes")


def print_size(path: pathlib.Path, rows: int) -> None:
    """Print a written file's name, rows and size."""
    print(f"{path.name}: {rows:,} rows, {path.stat().st_size / BYTES_PER_MB:.1f} MB")


if __name__ == "__main__":
    main()
