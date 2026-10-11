"""Build the site's data folder: `python -m site_data --release <dir> --simulation <dir> --out <dir>`.

Every week is loaded, checked and turned into rows before any file is
written, so a corrupted week stops the run, with its message and exit status
1, and the data folder untouched. Each Parquet file is sorted, here and only
here, by week and then by root session, so a session's tree sits together, and
is written one week at a time, so no row group holds two weeks. The indexes
`harnesses.json` and `weeks.json` are written last.
"""

import argparse
import pathlib
import sys

import pandas
import pyarrow
from pyarrow import compute, parquet

from release import reader
from site_data import harnesses, loading, paths, requests, sessions, simulation, tool_calls, weeks

ROWS_PER_GROUP = 100_000  # a row group holds one week's rows only, so a query filtered by week skips the others; large, so a query makes few ranged reads
COMPRESSION = "zstd"  # small files that DuckDB-WASM reads
BYTES_PER_MB = 1_000_000  # sizes are printed in decimal megabytes, the unit of the host's file size limit
# Each file's row order: by week, then by root session where the rows have one, so a query filtered by either
# reads only the row groups that hold them.
SORT_ORDERS = {
    paths.REQUESTS_FILE: ["week", "root_session_id", "session_id", "step"],
    paths.TOOL_CALLS_FILE: ["week", "root_session_id", "session_id", "step", "call_index"],
    paths.SESSIONS_FILE: ["week", "root_session_id", "session_id"],
    paths.SIMULATION_FILE: ["week", "scope", "policy", "ttl"],
}


def main(arguments: list[str] | None = None) -> None:
    """Write the four Parquet files, `harnesses.json` and `weeks.json` into the output folder, and print each file's
    rows and size."""
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
    for file_name, frame in frames.items():
        sorted_frame = frame.sort_values(SORT_ORDERS[file_name], ignore_index=True)
        write_parquet(sorted_frame, options.out / file_name)
        print_size(options.out / file_name, len(sorted_frame))
    harness_entries = harnesses.harnesses_index(frames[paths.SESSIONS_FILE])
    print_size(harnesses.write_harnesses_file(harness_entries, options.out), len(harness_entries))
    print_size(weeks.write_weeks_file(entries, options.out), len(entries))


def parsed_arguments(arguments: list[str] | None) -> argparse.Namespace:
    """The release, simulation and output folders named on the command line."""
    parser = argparse.ArgumentParser(prog="python -m site_data", description="Build the site's data folder.")
    parser.add_argument("--release", type=pathlib.Path, required=True, help="the release folder, one folder per week")
    parser.add_argument("--simulation", type=pathlib.Path, required=True, help="the cache simulation's folder")
    parser.add_argument("--out", type=pathlib.Path, required=True, help="the data folder to write")
    return parser.parse_args(arguments)


def site_frames(release: loading.WeekTaggedRelease, simulation_directory: pathlib.Path,
                entries: list[weeks.WeekEntry]) -> dict[str, pandas.DataFrame]:
    """The four frames of the site, by the name of the file each is written to."""
    site_requests = requests.requests_frame(release)
    return {
        paths.REQUESTS_FILE: site_requests,
        paths.TOOL_CALLS_FILE: tool_calls.tool_calls_frame(release, site_requests),
        paths.SESSIONS_FILE: sessions.sessions_frame(release, site_requests),
        paths.SIMULATION_FILE: simulation.simulation_frame(simulation_directory, entries),
    }


def write_parquet(frame: pandas.DataFrame, path: pathlib.Path) -> None:
    """Write a frame sorted by week, each week's rows in row groups of their own."""
    table = pyarrow.Table.from_pandas(frame, preserve_index=False)
    with parquet.ParquetWriter(path, table.schema, compression=COMPRESSION) as writer:
        for week in frame.week.unique():
            week_rows = table.filter(compute.equal(table["week"], week))
            writer.write_table(week_rows, row_group_size=ROWS_PER_GROUP)


def print_size(path: pathlib.Path, rows: int) -> None:
    """Print a written file's name, rows and size."""
    print(f"{path.name}: {rows:,} rows, {path.stat().st_size / BYTES_PER_MB:.1f} MB")


if __name__ == "__main__":
    main()
