"""The names of the folders and files the data step writes into the site's data folder, and the JSON form they are
written in.

The indexes are `weeks.json` and `harnesses.json`. The answers of the default selection are at
`all_weeks/<folder>/<query>.json`, with the hash of each query's text in `all_weeks/queries.json`. The Session page's
rows are in gzipped JSON buckets, `session_buckets/<sunday>/<xx>.json.gz`, `xx` the first two characters of a
top-level session's id, beside the week's index `session_buckets/<sunday>/index.json.gz`.
"""

WEEKS_FILE = "weeks.json"  # the index of weeks, read by every page first
HARNESSES_FILE = "harnesses.json"  # the index of harnesses, read by every page first
ANSWERS_FOLDER = "all_weeks"  # the default selection's answers of every Explore and figure query, and the colour orders
QUERY_HASHES_FILE = "queries.json"  # in the answers folder: the hash of the text of each query the answers come from
SESSION_BUCKETS_FOLDER = "session_buckets"  # one folder per week, `<sunday>`, of the Session page's gzipped buckets
BUCKET_SUFFIX = ".json.gz"  # a bucket is `<xx>.json.gz`, `xx` the first characters of its top-level sessions' ids
BUCKET_INDEX_FILE = "index.json.gz"  # in a week's bucket folder: every session id of the week to its top-level id
# Commas and colons without spaces, in the answers and the buckets alike: every byte is fetched by the visitors.
JSON_SEPARATORS = (",", ":")


def answer_file(query_name: str) -> str:
    """The path of a query's answer, relative to the data folder: `all_weeks/<folder>/<query>.json`."""
    return f"{ANSWERS_FOLDER}/{answer_file_in_folder(query_name)}"


def answer_file_in_folder(query_name: str) -> str:
    """The path of a query's answer, relative to the answers folder: `<folder>/<query>.json`."""
    return f"{query_name}.json"


def bucket_file(week: str, prefix: str) -> str:
    """The path of a week's bucket of the top-level sessions whose ids start with `prefix`, relative to the data
    folder: `session_buckets/<sunday>/<prefix>.json.gz`."""
    return f"{SESSION_BUCKETS_FOLDER}/{week}/{prefix}{BUCKET_SUFFIX}"


def bucket_index_file(week: str) -> str:
    """The path of a week's bucket index, relative to the data folder: `session_buckets/<sunday>/index.json.gz`."""
    return f"{SESSION_BUCKETS_FOLDER}/{week}/{BUCKET_INDEX_FILE}"
