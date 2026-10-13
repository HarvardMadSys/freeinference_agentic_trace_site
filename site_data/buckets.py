"""The Session page's rows, precomputed: for each week of the data folder, the rows of every top-level session and its
subagents in gzipped JSON buckets, and an index from every session id of the week to its top-level session's id.

The three bucket queries, `BUCKET_PARTS`, are run over the site's database (`site_data/site_database.py`) with one
week selected at a time. Each returns `root_session_id`, the top-level session's id, which groups its rows and is then
dropped from every row: it is the key. A top-level session's entry is

    {"tree": {"columns": [...], "rows": [[...], ...]}, "requests": {...}, "tool_calls": {...}}

each part holding its query's columns and the session's rows, each row its values in column order, in the query's
order. The entries whose top-level ids share their first `PREFIX_LENGTH` characters are written together as
`session_buckets/<sunday>/<xx>.json.gz`, an object from top-level id to entry. A prefix that only subagents' ids
start with has an empty bucket, so that a subagent's link finds a file before it turns to the index; a prefix no
session id of the week starts with has no file. `session_buckets/<sunday>/index.json.gz` is an object from every
session id of the week, subagents included, to its top-level id.

Keys are sorted, rows keep the queries' order, and the gzip header holds no time, so a rebuild of the same rows writes
the same bytes.
"""

import dataclasses
import gzip
import json
import pathlib
import shutil
import statistics

import duckdb

from site_data import harnesses, paths, site_database, weeks

# The query that fills each part of a top-level session's entry, by the part's name in the bucket.
BUCKET_PARTS = {
    "tree": "buckets/week_tree",
    "requests": "buckets/week_requests",
    "tool_calls": "buckets/week_tool_calls",
}
ROOT_COLUMN = "root_session_id"  # the column each bucket query groups its rows by, dropped from the rows written
SESSION_COLUMN = "session_id"  # the tree's column naming each session, top-level or subagent, for the index
# A bucket holds the top-level sessions whose ids share this many first characters: about 256 buckets a week, of a few
# sessions each, so opening a session fetches tens of kilobytes from a folder of a few hundred files.
PREFIX_LENGTH = 2
GZIP_LEVEL = 9  # fixed, so the same rows always compress to the same bytes
GZIP_TIME = 0  # the modification time written in each gzip header; fixed for the same reason


@dataclasses.dataclass(frozen=True)
class WrittenBuckets:
    """What the buckets folder holds over every week."""

    buckets: int
    indexes: int  # one per week
    bytes: int  # of the buckets and the indexes together
    median_bucket_bytes: int
    largest_bucket_bytes: int


def write_buckets(connection: duckdb.DuckDBPyConnection, data_directory: pathlib.Path) -> WrittenBuckets:
    """Replace the data folder's buckets folder with the buckets and the index of every week of its `weeks.json`, from
    the site's database."""
    buckets_directory = data_directory / paths.SESSION_BUCKETS_FOLDER
    if buckets_directory.exists():
        shutil.rmtree(buckets_directory)  # a week or a prefix no longer in the data keeps no file
    every_harness = [entry.harness for entry in harnesses.read_harnesses_file(data_directory)]
    bucket_sizes, index_sizes = [], []
    for entry in weeks.read_weeks_file(data_directory):
        site_database.select_weeks(connection, [entry.week], every_harness)
        parts = week_parts(connection)
        index = session_index(parts["tree"])
        for prefix, bucket in buckets_by_prefix(sessions_by_root(parts), index).items():
            bucket_sizes.append(write_gzipped_json(bucket, data_directory / paths.bucket_file(entry.week, prefix)))
        index_path = data_directory / paths.bucket_index_file(entry.week)
        index_sizes.append(write_gzipped_json(index, index_path))
    return WrittenBuckets(
        buckets=len(bucket_sizes),
        indexes=len(index_sizes),
        bytes=sum(bucket_sizes) + sum(index_sizes),
        median_bucket_bytes=int(statistics.median(bucket_sizes)) if bucket_sizes else 0,
        largest_bucket_bytes=max(bucket_sizes, default=0),
    )


def week_parts(connection: duckdb.DuckDBPyConnection) -> dict[str, site_database.QueryRows]:
    """Each bucket query's rows over the week the selection table holds, by the part they fill."""
    parts = {}
    for part, query_name in BUCKET_PARTS.items():
        parts[part] = site_database.query_rows(connection, query_name)
    return parts


def sessions_by_root(parts: dict[str, site_database.QueryRows]) -> dict[str, dict]:
    """The entry of each top-level session of the tree's rows, by its id, sorted: each part's columns but
    `ROOT_COLUMN`, and the part's rows of that top-level session, in their order, without it. A top-level session
    with no rows of a part has an empty list of them."""
    roots = sorted(set(column_values(parts["tree"], ROOT_COLUMN)))
    sessions = {}
    for root in roots:
        sessions[root] = empty_entry(parts)
    for part, query in parts.items():
        root_index = query.columns.index(ROOT_COLUMN)
        for row in query.rows:
            sessions[row[root_index]][part]["rows"].append(without_index(row, root_index))
    return sessions


def empty_entry(parts: dict[str, site_database.QueryRows]) -> dict:
    """A top-level session's entry with every part's columns but `ROOT_COLUMN`, and no rows yet."""
    entry = {}
    for part, query in parts.items():
        entry[part] = {"columns": without_index(query.columns, query.columns.index(ROOT_COLUMN)), "rows": []}
    return entry


def without_index(values: list, index: int) -> list:
    """A copy of `values` without the one at `index`."""
    return values[:index] + values[index + 1:]


def column_values(query: site_database.QueryRows, column: str) -> list:
    """The values of the query's column `column`, one per row, in the rows' order."""
    index = query.columns.index(column)
    return [row[index] for row in query.rows]


def buckets_by_prefix(sessions: dict[str, dict], index: dict[str, str]) -> dict[str, dict]:
    """The entries of `sessions` grouped by the first `PREFIX_LENGTH` characters of their top-level ids, the prefixes
    sorted and each bucket's ids in the order of `sessions`; a prefix only a subagent's id in `index` starts with
    gets an empty bucket."""
    buckets = {}
    for session_id in index:
        buckets.setdefault(session_id[:PREFIX_LENGTH], {})
    for root, entry in sessions.items():
        prefix = root[:PREFIX_LENGTH]
        if prefix not in buckets:
            buckets[prefix] = {}
        buckets[prefix][root] = entry
    return dict(sorted(buckets.items()))


def session_index(tree: site_database.QueryRows) -> dict[str, str]:
    """Every session id of the tree's rows to its top-level session's id, sorted by session id."""
    index = dict(zip(column_values(tree, SESSION_COLUMN), column_values(tree, ROOT_COLUMN)))
    return dict(sorted(index.items()))


def write_gzipped_json(value: object, path: pathlib.Path) -> int:
    """Write `value` as one line of JSON, gzipped at `GZIP_LEVEL` with the time `GZIP_TIME`; return the file's size."""
    # allow_nan=False: the database holds a missing number as null, so a NaN or an infinity here is an error to stop on
    # rather than invalid JSON to ship.
    text = json.dumps(value, separators=paths.JSON_SEPARATORS, allow_nan=False)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(gzip.compress(text.encode(), compresslevel=GZIP_LEVEL, mtime=GZIP_TIME))
    return path.stat().st_size
