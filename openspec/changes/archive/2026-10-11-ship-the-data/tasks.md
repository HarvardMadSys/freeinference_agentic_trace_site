# Tasks

Archive `one-page-all-weeks` before this change: both modify the layout
requirement of `site-repository`, and this one builds on its text.

- [x] 1.1 Track `site/data`: drop it from `.gitignore` and add the built data; the repository test requires the indexes, the query hashes and every week's row files tracked; `tests/test_answers.py` requires the shipped answers to come from each query's current text. Verify `make test` green with the data tracked, and that editing a query's text makes it fail.
- [x] 1.2 README, CONTRIBUTING and CLAUDE.md: a clone serves the site as it is; rebuilding takes the pipeline repository and is committed with its change; the layout's `data/` line.

## Verification record

- 116 files, 70 MB, none over 20 MB, tracked.
- `make test`: 393 passed with the paper's numbers present (370 passed, 23 skipped without), 297 node tests.
- A query's text changed by one character: `test_shipped_answers_come_from_the_current_queries` names it.
