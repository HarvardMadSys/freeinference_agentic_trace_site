"""Whether the answers in a data folder come from the queries as they are now: each answered query's text is hashed
and compared with the hash `make data` recorded in `all_weeks/queries.json` when it wrote the answers.

A query is stale when its text has changed since, or when no hash of it was recorded (a query added since). A data
folder with no `queries.json` has no answers to check, or answers written before the hashes were; either way, `make
data` is to be run first. `make deploy` runs this check first and refuses to publish stale answers:

    python -m site_data.check_answers [--data site/data]

It prints "answers match N queries", or names each stale query and exits with status 1.
"""

import argparse
import dataclasses
import json
import pathlib
import sys

from site_data import answers, paths, site_database

DEFAULT_DATA_FOLDER = pathlib.Path("site/data")  # as `make data` writes it, relative to the repository's root
# Why a query is stale, as the check names it.
CHANGED = "its text changed since make data wrote its answer"  # its hash is not the recorded one
UNRECORDED = "no recorded answer"  # `queries.json` holds no hash of it


@dataclasses.dataclass(frozen=True)
class StaleQuery:
    """An answered query whose answer may not be its current text's, and why."""

    name: str  # `<folder>/<query>`
    reason: str  # `CHANGED` or `UNRECORDED`


def hashes_file(data_directory: pathlib.Path) -> pathlib.Path:
    """The file of the query hashes the data folder's answers were written with: `all_weeks/queries.json`."""
    return data_directory / paths.ANSWERS_FOLDER / paths.QUERY_HASHES_FILE


def stale_queries(data_directory: pathlib.Path,
                  queries_folder: pathlib.Path = site_database.QUERIES_FOLDER) -> list[StaleQuery]:
    """Each answered query of `queries_folder` whose text's hash is not the one recorded in the data folder's
    `queries.json`, by name."""
    recorded = json.loads(hashes_file(data_directory).read_text())
    stale = []
    for name, current_hash in answers.query_hashes(queries_folder).items():
        if name not in recorded:
            stale.append(StaleQuery(name=name, reason=UNRECORDED))
        elif recorded[name] != current_hash:
            stale.append(StaleQuery(name=name, reason=CHANGED))
    return stale


def main(arguments: list[str] | None = None) -> None:
    """Print that the data folder's answers match every answered query, or name each stale one and exit with 1."""
    parser = argparse.ArgumentParser(prog="python -m site_data.check_answers",
                                     description="Check that the answers come from the queries as they are now.")
    parser.add_argument("--data", type=pathlib.Path, default=DEFAULT_DATA_FOLDER, help="the site's data folder")
    options = parser.parse_args(arguments)
    if not hashes_file(options.data).exists():
        print(f"{hashes_file(options.data)} does not exist: run make data first", file=sys.stderr)
        raise SystemExit(1)
    stale = stale_queries(options.data)
    if stale:
        for query in stale:
            print(f"{query.name}: {query.reason}", file=sys.stderr)
        print(f"{len(stale)} queries have stale answers: run make data", file=sys.stderr)
        raise SystemExit(1)
    print(f"answers match {len(answers.answered_query_names())} queries")


if __name__ == "__main__":
    main()
