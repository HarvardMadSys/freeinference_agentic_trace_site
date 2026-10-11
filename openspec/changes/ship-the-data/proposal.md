# Proposal

## Why

The site's data, 70 MB of Parquet files and JSON answers under
`site/data`, is built from the pipeline repository's package and its
release, and the repository ignores it. So a clone of the site cannot serve
anything until its owner has installed the pipeline, found or downloaded
the release and run `make data`, for data that changes only when the
release gains a week or a query changes. The site should be served from a
clone as it is.

## What Changes

- **`site/data` is tracked.** The repository ships the data `make data`
  built: the week files, the indexes, the answers and the query hashes.
  `make serve` works in a fresh clone.
- **`make test` checks the shipped answers.** The hash check that
  `make deploy` runs, that each answer was written from its query's current
  text, becomes a test, so a query edited without `make data` fails the
  suite, and the repository test checks the shipped data is whole: every
  week in `weeks.json` has its row files tracked.
- **Rebuilding stays the maintainer's step.** `make setup` and `make data`
  take the pipeline repository as before, named by `PIPELINE` or by
  `RELEASE` and `SIMULATION`; the rebuilt data is committed with the change
  that needed it.

## Impact

- `site-repository`: the layout's `data/` line; a requirement that the
  shipped data is whole and current.
- Files: `.gitignore`, `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`,
  `tests/test_repository.py`, `tests/test_answers.py`, and `site/data`.
- Each rebuild adds about 70 MB to the repository's history; the data is
  rebuilt when the release or a query changes, not routinely.
