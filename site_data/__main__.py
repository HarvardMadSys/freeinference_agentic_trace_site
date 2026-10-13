"""Build the site's data folder: `python -m site_data --release <dir> --simulation <dir> --out <dir>`.

Every week is loaded, checked and turned into the site's four frames of rows
(`site_data/requests.py`, `tool_calls.py`, `sessions.py`, `simulation.py`)
before any file is written, so a corrupted week stops the run, with its
message and exit status 1, and the data folder untouched. The indexes
`harnesses.json` and `weeks.json` are written first, then the answers of the
default selection, and last the Session page's buckets, both from the site's
database over the frames in memory (`site_data/site_database.py`,
`answers.py`, `buckets.py`).
"""

import argparse
import pathlib
import sys

from release import reader
from site_data import (answers, buckets, harnesses, loading, paths, requests, sessions, simulation, site_database,
                       tool_calls, weeks)

BYTES_PER_MB = 1_000_000  # sizes are printed in decimal megabytes, the unit of the host's file size limit


def main(arguments: list[str] | None = None) -> None:
    """Write `harnesses.json`, `weeks.json`, the answers and the session buckets into the output folder, and print
    each index's rows and size, the answers' files and bytes, and the buckets' count and size."""
    options = parsed_arguments(arguments)
    try:
        entries = weeks.weeks_index(options.release, options.simulation)
        release = loading.load_release(options.release, entries)
    except reader.ReleaseError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1)
    frames = site_frames(release, options.simulation, entries)
    del release  # the frames hold every row the queries read; the release's own copy is freed before they run
    options.out.mkdir(parents=True, exist_ok=True)
    harness_entries = harnesses.harnesses_index(frames.sessions)
    print_size(harnesses.write_harnesses_file(harness_entries, options.out), len(harness_entries))
    print_size(weeks.write_weeks_file(entries, options.out), len(entries))
    # The block closes the connection whether or not a query fails.
    with site_database.open_site_database(frames, harness_entries) as connection:
        written_answers = answers.write_answers(connection, options.out)
        print(f"{paths.ANSWERS_FOLDER}: {written_answers.files} files, {written_answers.bytes:,} bytes")
        print_buckets(buckets.write_buckets(connection, options.out))


def parsed_arguments(arguments: list[str] | None) -> argparse.Namespace:
    """The release, simulation and output folders named on the command line."""
    parser = argparse.ArgumentParser(prog="python -m site_data", description="Build the site's data folder.")
    parser.add_argument("--release", type=pathlib.Path, required=True, help="the release folder, one folder per week")
    parser.add_argument("--simulation", type=pathlib.Path, required=True, help="the cache simulation's folder")
    parser.add_argument("--out", type=pathlib.Path, required=True, help="the data folder to write")
    return parser.parse_args(arguments)


def site_frames(release: loading.WeekTaggedRelease, simulation_directory: pathlib.Path,
                entries: list[weeks.WeekEntry]) -> site_database.SiteFrames:
    """The site's four frames of rows, each with its `week` column."""
    request_misses = simulation.request_misses_frame(simulation_directory, entries)
    site_requests = requests.requests_frame(release, request_misses)
    return site_database.SiteFrames(
        requests=site_requests,
        tool_calls=tool_calls.tool_calls_frame(release, site_requests),
        sessions=sessions.sessions_frame(release, site_requests),
        simulation=simulation.simulation_frame(simulation_directory, entries),
    )


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
