# Proposal

## Why

The FreeInference agentic trace is published as weekly Parquet and JSONL
files, and the paper's figures are drawn once, over every week at once. To
look at one week, one month or one session, a reader has to download the
release and write code. A public, static visualizer and explorer would let
anyone do this in a browser, with nothing to install and no server to run.
It would show the paper's figures for any chosen weeks and open any session
to see its context grow, its cache hits, its tools and its subagents.

## What Changes

- **A new repository, `freeinference-trace-site`.** It holds a small Python
  step and a static website, nothing else.
- **A site data step.** `python -m site_data` reads a release folder (the
  pipeline's `data/v1`, local or downloaded) and writes four Parquet files:
  requests, tool calls, sessions and the cache simulation's tallies.
  - They have the release's columns minus `block_ids`, plus a few columns the
    pipeline already defines (week, turn, scope, uncached tokens, wait, idle
    gap, root session).
  - The step calls the pipeline's functions for every definition, so the
    site and the paper cannot disagree.
  - All 16 weeks take about 40 MB.
- **One logical table per kind of row, filtered by week in the browser.**
  Each page opens DuckDB-WASM in the visitor's browser and runs one SQL
  query per chart over the Parquet files on HTTP. A query reads only the
  columns and weeks it needs.
- **Four pages, plain HTML and ES modules, charts in Observable Plot:**
  - **Explore**, the landing page: weekly trends, headline numbers,
    distribution cards with percentile guides, and a searchable, sortable
    table of the selected weeks' sessions, which leads into a session.
  - **Paper figures**: about 15 of the paper's figures for the selected
    weeks and scope, including the prefix-caching figures that draw on the
    cache simulation.
  - **Session**: one session with its subagents nested under the steps that
    spawned them, in three views. *Requests* is a bar per request split into
    cached, uncached and output tokens. *Context* is input over elapsed time
    with one line per agent. *Timeline* is a Gantt chart of model and tool
    time per agent.
  - **About**: definitions and links.
- **A week selection kept in the URL.** It can be any set of weeks, a whole
  month or every week, plus a scope (Agentic, SWE-Bench, All). It is shared
  by Explore and Paper figures, so any view can be shared as a link, down to
  one step of one session.
- **No server, no framework, no bundler.** The deployed site is a folder of
  static files.

## Capabilities

### New Capabilities

- `site-repository`: the repository's layout, engineering rules,
  dependencies, navigation, tests and deployment.
- `site-data`: the Parquet files the site reads, including their rows,
  columns, ordering and size, and how they are built from a release.
- `week-selection`: choosing weeks, months and scope, and keeping the choice
  in the URL across pages.
- `explore-page`: the landing page's trends, headline numbers, distribution
  cards and sessions table.
- `figures-page`: the paper's figures, drawn for a selection.
- `session-page`: one session and its subagents, in the Requests, Context
  and Timeline views.

### Modified Capabilities

None. The pipeline repository is not changed; the site imports its public
packages as they are.

## Impact

- **New code**: the `freeinference-trace-site` repository: Python
  `site_data/`, the static `site/` folder, and tests.
- **Dependencies**: in Python, the pipeline's public packages (`release`,
  `paper`, `simulation`) and pyarrow, with DuckDB for tests only. In the
  browser, DuckDB-WASM and Observable Plot, loaded from a CDN at pinned
  versions. There is no npm runtime dependency.
- **Hosting**: a static host that answers HTTP range requests (GitHub
  Pages). The published data are what the anonymous release already
  publishes, minus `block_ids`.
- **The pipeline repository**: unchanged. If the site needs a definition
  that is private there today, the change that needs it first makes it
  public there.
