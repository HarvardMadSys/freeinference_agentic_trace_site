# Design

## Context

Two ways to make a clone of the site self-sufficient were weighed: the
site fetching the pipeline and the release itself at build time (a shallow
clone and a 9 GB download, for 70 MB of output), or shipping the output.
The data changes rarely, so the repository ships it.

## Decisions

- **Plain files in git, no large-file extension.** No file exceeds 20 MB
  and the whole is 70 MB, under any host's limits, and a static host serves
  tracked files with range requests as it serves any other.
- **The check is a test.** `check_answers.stale_queries` already decides
  whether an answer is current; `tests/test_answers.py` calls it on the
  tracked folder, and `make deploy` keeps running it, so both gates share
  one rule.
- **Whole, not merely present.** The repository test reads `weeks.json`
  and requires a tracked row file per kind and week, so a week built but not
  added, or a file removed, fails.
- **The build is unchanged.** `make data` and its inputs stay as they are;
  only what happens to its output changes.
