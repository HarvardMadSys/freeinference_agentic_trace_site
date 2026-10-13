# site Specification

## Purpose
The site as a repository: its layout, the rules its code follows, what it
depends on, how it is tested and deployed; the data folder it serves, the
indexes, the precomputed answers and the session buckets, and how `make
data` builds them from a release; and the selection tables the data step
fills before it answers a query.

## Requirements

### Requirement: The code follows CONTRIBUTING
The code SHALL follow the rules in `CONTRIBUTING.md`, which are binding:
simple before fast, plain over clever, names that are words, one job per
unit (a function at most 50 lines, a module at most 300, a folder at
most about nine modules), docstrings that state definitions and comments
that say why, and SQL as literals in one `.sql` file each under
`site/queries/`, reading the selection from the selection tables and
from nothing else. The tests SHALL enforce the countable rules.

#### Scenario: A function that grew
- **WHEN** a Python or JavaScript function exceeds 50 lines
- **THEN** the line-count test SHALL fail until it is split

#### Scenario: An assembled query
- **WHEN** a JavaScript file holds a SQL statement
- **THEN** the test that scans `site/js/` for SQL statements SHALL fail

#### Scenario: A header that grew
- **WHEN** a module's header comment exceeds ten lines
- **THEN** the node test SHALL list it as a warning for review, and `make test` SHALL still pass

### Requirement: Repository layout
The repository SHALL have this layout, and git SHALL track nothing beyond it
and `.gitignore`:

```
README.md         what the site shows, where the numbers come from, how to build the data, serve and deploy
CONTRIBUTING.md   the rules, the patterns to copy, and how to verify a change
CLAUDE.md         a pointer to the two files above and the git rules
Makefile          make setup, setup-browser, data, serve, test, snapshots, deploy
wrangler.jsonc    the Cloudflare Worker that serves site/ as static assets
pyproject.toml    Python 3.12; the pipeline's package, pyarrow, pandas, duckdb; pytest and Playwright (pinned) for tests
package.json      sets ES modules for node --test; wrangler, the one dev dependency; package-lock.json pins it
.nvmrc            the Node version the deploy workflow uses
.github/          workflows/deploy.yml: the deploy on every push to main
site_data/        builds site/data/ from a release folder: the indexes, the answers, the session buckets
site/             exactly the files that are deployed
  *.html          one file per page: index (Explore, the landing page), session
  style.css       tokens, layout and components
  favicon.svg     the brand mark, for the browser tab
  js/shared/      the answers, the libraries, formatting, charts, series, the table, the layout
  js/charts/      the seven chart kinds: cdf, stacked_bars, ranges, histogram, ranked, knee_lines, donut
  js/axes/        the ticks of every chart's axes
  js/theme/       the site's colours as the style tokens give them
  js/pages/       one module per page
  js/landing/     the hero, the stats strip, the donuts, the cite and team sections
  js/explore/     the Explore page's start and its sections: the trends, the session list, the figure runner and its row rules, the legend, the topic tabs
  js/figures/, js/simulation/, js/comparison/
                  the figure sections' modules
  js/session/     the Session page's bucket loader, address, agent tree, facts card, legends, token parts, and the views' chart start and request click
  js/session_requests/  the Requests view
  js/session_charts/    the Context and Timeline views, their series, bars, range slider and pointer
  queries/        one .sql file per chart or table, in one folder per purpose: explore, figures, buckets, setup
  data/           built by make data and tracked: the indexes, the answers, the session buckets; a clone serves the site without building
tests/            Python tests, node --test files, and snapshots/: the twelve page states as text
openspec/         the specs and the open changes; archived changes live in git history
```

#### Scenario: Generated data is never committed
- **WHEN** `site/data` changes after `make data`
- **THEN** it SHALL be committed with the change that needed it, and the repository test SHALL require it whole and current

### Requirement: No front-end build and no npm runtime dependency
The site SHALL be plain HTML, CSS and ES modules served as they are in
`site/`. It SHALL NOT need a bundler, a transpiler or `npm install` to run.
Browser libraries SHALL be loaded from a CDN at exact, pinned versions, and
every library URL SHALL be written once, in one module that the rest of the
code imports from.

#### Scenario: Serving the source folder
- **WHEN** `site/` (with its data) is served by any static file server
- **THEN** every page SHALL work without a build step

#### Scenario: A library URL outside its home
- **WHEN** a CDN URL appears in any file other than the one library module
- **THEN** the repository test SHALL fail

### Requirement: Definitions come from the pipeline
Every quantity the site shows SHALL be defined once, in the pipeline's public
packages, or be a plain count, sum, ratio of sums, or quantile of a column
the site data step wrote. The site SHALL NOT re-implement a definition the
pipeline already has (turn, scope, wait, hit ratio, uncached tokens, idle
gap).

#### Scenario: A new derived column
- **WHEN** a figure needs a per-request quantity that is not a release column
- **THEN** the site data step SHALL compute it by calling the pipeline's function, and the browser SHALL only read it

### Requirement: Navigation
The site SHALL have two pages, Explore (`index.html`, the landing page)
and Session (`session.html`).
Both SHALL share one sticky header: the brand "FreeInference Agentic
Dataset" linking to the Explore page, the in-page links Overview, Session Explorer,
Insights and Cite, and no link off the site. On a phone the header SHALL
be two rows, the brand on the first and the four links on the second,
wrapping as they need; nothing in the header SHALL scroll sideways or be
cut off. The header SHALL NOT name the lab nor link the
dataset, the paper, the code or Open Data; the hero and the footer do.
The header SHALL stay at the top while the page scrolls,
and every anchored section SHALL land below it. There SHALL be no About
page and no About paragraph; the definitions live behind each card's control, the differences
from the paper in README's "Where the numbers come from", and the credits
and citation on the landing page.

#### Scenario: Moving between pages
- **WHEN** the visitor opens a session from the list and follows the header's Session Explorer link
- **THEN** the Explore page SHALL open at the Session Explorer with the list's state kept

#### Scenario: Scrolling
- **WHEN** the visitor scrolls any page
- **THEN** the header SHALL remain visible at the top

#### Scenario: The current page
- **WHEN** the visitor is on the Session page
- **THEN** the header's Session Explorer link SHALL be marked and the others not

#### Scenario: A phone
- **WHEN** the page is opened 360 pixels wide
- **THEN** all four links SHALL be visible under the brand without scrolling the header

### Requirement: Tests
`make test` SHALL run the Python tests and `node --test`, and SHALL pass at
every commit. Every `.sql` file SHALL be run by a test against data built from
a small fixture release, with the selection tables filled, and SHALL return
the columns its chart reads. For every query that has a precomputed answer,
a test SHALL check that the answer written for the fixture equals the query
run live with the default selection. A snapshot test SHALL hold, under
`tests/snapshots/`, the normalised text of every chart, table, legend and text
block of twelve page states (the landing page with each topic shown, and
two fixed sessions, one of them with subagents, each in its three
views), compare them in headless Chromium on `make test`,
and be rewritten by `make snapshots` when a change is meant; it SHALL
skip, saying so, where Chromium is not installed, and fail, naming the
host, where the libraries or fonts cannot load.

#### Scenario: A query that no longer matches the data
- **WHEN** a column a query reads is renamed in the site data
- **THEN** `make test` SHALL fail on that query

#### Scenario: An answer that no longer matches its query
- **WHEN** the answer writer rounds, renames or drops a column the live query returns
- **THEN** `make test` SHALL fail on that query

#### Scenario: A chart that changed
- **WHEN** a figure's insight, a tick or a series colour changes without `make snapshots`
- **THEN** `make test` SHALL fail naming that chart

### Requirement: Deployment
`make deploy` SHALL publish `site/`, including its generated data, to the
Cloudflare Worker that `wrangler.jsonc` names, which serves `site/` as
static assets. A push to
`main` SHALL deploy the same way through the repository's deploy workflow,
which SHALL then ask the published site for the Explore page (`/`), the
weeks index and the newest week's bucket index, and fail on any answer
but 200.

#### Scenario: Deploying a new week
- **WHEN** a week is added to the release and `make data deploy` runs
- **THEN** the published site SHALL show the new week

#### Scenario: A page missing after a deploy
- **WHEN** the published site answers `/` with 404
- **THEN** the deploy workflow SHALL fail naming that path

### Requirement: The built data ships with the repository
Git SHALL track `site/data` as `make data` built it: the indexes, the
answers, the query hashes, and every week's session
buckets and bucket index. The shipped data SHALL be whole, with a tracked
bucket index for every week in
`weeks.json`, and current, with every answer written from its query's
current text; `make test` SHALL fail otherwise. Rebuilding the data
remains `make data` from the pipeline repository, and the rebuilt data is
committed with the change that needed it.

#### Scenario: Serving a fresh clone
- **WHEN** the repository is cloned and `make serve` runs
- **THEN** every released week SHALL be shown, and every session opened, without building anything

#### Scenario: A query edited without rebuilding
- **WHEN** the text of an answered or bucket query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: A week built but not added
- **WHEN** `weeks.json` names a week whose bucket index is not tracked
- **THEN** the repository test SHALL fail naming the file

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
be set in the display serif and keep their ratios to the base. The
360-pixel layout SHALL still fit without horizontal scrolling.

#### Scenario: The smallest text
- **WHEN** any page is opened at desktop width
- **THEN** the computed size of every text element SHALL be at least 14 px

#### Scenario: A phone
- **WHEN** the Explore page is opened 360 pixels wide
- **THEN** the page SHALL not scroll sideways

### Requirement: The look follows Open Data
The site SHALL use Open Data's tokens: the paper background `#f8f7f5`,
white surfaces, ink `#1c1917`, the rule `#e4dfdb`, the crimson accent
`#a51c30` with its dark and tint; Crimson Text for headings, the stat
numbers and the affiliation, Inter for body text, and the monospace
stack, uppercase and letter-spaced, for eyebrows, chips, the nav and the
cite caption. Cards SHALL carry a 1px rule, a soft shadow and a 0.9rem
radius. A dark scheme SHALL follow the visitor's system preference, with
the paper, surfaces and inks retuned dark. The eight series slots SHALL
be the same hues in both schemes, at least 30° apart in OKLCH, each at least 3:1 in
contrast against its scheme's card, and a test SHALL check every colour
token's contrast in both schemes. The parts of a session's time SHALL be
coloured as the paper colours them: prefill blue, decode orange, tool
green, user idle red.

#### Scenario: A heading
- **WHEN** any heading renders
- **THEN** its computed font family SHALL begin with Crimson Text

#### Scenario: Dark system scheme
- **WHEN** the visitor's system prefers a dark scheme
- **THEN** the page SHALL render on the dark paper with every series at least 3:1 against its card

#### Scenario: A series keeps its identity
- **WHEN** the same harness is drawn in light and in dark
- **THEN** it SHALL have the same hue in both

### Requirement: Built from a release folder
`python -m site_data --release <dir> --simulation <dir> --out site/data`
SHALL read every week of a release folder in the layout the pipeline
publishes (`<dir>/<week>/` with `requests.parquet`, `tool_calls.parquet`,
`sessions.parquet`, `manifest.json`), check each week through the pipeline's
reader, and write the files below. It SHALL never read `block_ids` or the
trace files. Rebuilding from the same release SHALL write identical files.

#### Scenario: A week whose hashes do not match its manifest
- **WHEN** a week's table does not match the sha256 in its `tables.json`
- **THEN** the step SHALL stop with a message naming the week and write nothing

#### Scenario: Rebuilding
- **WHEN** the step runs twice on the same release
- **THEN** the two runs' files SHALL be byte for byte identical

### Requirement: Requests
The `requests` frame SHALL hold one row per request of every session, subagent
sessions included, with these columns:
- from the release: `session_id, step, start_ms, end_ms, ttft_ms, model,
  provider, step_trigger, waited_for, prompt_tokens, completion_tokens,
  cache_read_tokens`, the role tokens as `system_tokens, user_tokens,
  assistant_tokens, tool_tokens, tool_definition_tokens`, `n_messages,
  finish_reason, transition, cause`;
- added, each computed by the pipeline's definition: `harness`,
  `is_top_level` (the session has no parent), `root_session_id` (the
  top-level session it belongs to, itself for a top-level session), `depth`
  (0 for a top-level session, 1 for its subagents, and so on), `turn`,
  `uncached_tokens`,
  `hit_ratio` (missing where the provider reports no cache reads), `wait_s`
  (missing at step 0), `idle_gap_s` and `idle_gap_bin` (missing where the
  pipeline's idle-gap definition gives none), `is_trusted_ttft`,
  `n_tool_calls`, `user_prompt_tokens` (the tokens of a user step's new
  prompt, by the pipeline's function; missing for a tool step) and
  `missed_tokens_no_ttl` (the tokens the request missed with no TTL in the
  simulation, joined from its per-request misses; missing in a week
  without a simulation).

Definitions that look across weeks (the idle gap) SHALL be computed over all
weeks together, so a week's first requests get the same value as in the
paper; the idle gap SHALL be computed over the paper's Agentic top-level
requests as the paper computes it, and over the benchmark's top-level
requests apart, and a subagent's request SHALL have none.

#### Scenario: A request after a tool step
- **WHEN** a session's third request has `step_trigger = tool` and its first has `step_trigger = user`
- **THEN** its `turn` SHALL be 1 and its `wait_s` SHALL be its start minus the previous request's end, in seconds

#### Scenario: A user step's prompt
- **WHEN** a request is a user step whose new prompt the pipeline counts at 42 tokens
- **THEN** its `user_prompt_tokens` SHALL be 42, and the next tool step's SHALL be missing

#### Scenario: A request's misses
- **WHEN** the simulation's per-request misses give a request 1,500 tokens
- **THEN** its `missed_tokens_no_ttl` SHALL be 1500

### Requirement: Tool calls
The `tool_calls` frame SHALL hold one row per tool call with `session_id,
step, call_index, name, category, programs, arguments_skeleton, outcome,
result_tokens, latency_ms, harness, is_top_level, root_session_id`.
`programs` SHALL be the release's list of program labels, in the command's
order, for a shell call, and null for any other call; `arguments_skeleton`
SHALL be the release's, the call's arguments with every value replaced by
its type.

#### Scenario: A call joins its request
- **WHEN** a tool call has `session_id` S and `step` 4
- **THEN** exactly one row of `requests` SHALL have `session_id` S and `step` 4 in the same week

#### Scenario: A native call
- **WHEN** a tool call is not a shell call
- **THEN** its `programs` SHALL be null and its `arguments_skeleton` SHALL still be kept

### Requirement: Sessions
The `sessions` frame SHALL hold one row per session, subagents included, with
`session_id, harness, parent_session_id, spawned_by_step,
root_session_id, depth, user_id`, and per session, counting its own requests
only: `requests, user_steps, tool_steps, tool_calls, first_start_ms,
duration_s, input_tokens, reported_input_tokens` (the input tokens of the
requests whose provider reports cache reads), `cached_tokens` (their cache
reads), `output_tokens, peak_prompt_tokens, main_model` (the model of most of its requests, the first in name order on a
tie). A top-level session SHALL also hold `subagents` (its subagent sessions
at every depth) and `subagent_requests` (their requests).

#### Scenario: A subagent of a subagent
- **WHEN** top-level session T spawned subagent A, which spawned subagent B
- **THEN** B's `root_session_id` SHALL be T and its `depth` 2, and T's `subagents` SHALL be 2

#### Scenario: Totals agree with requests
- **WHEN** the requests of session S are summed
- **THEN** their count and token sums SHALL equal the session's `requests`, `input_tokens`, `cached_tokens` and `output_tokens`

### Requirement: Simulation tallies
The `simulation` frame SHALL hold the cache simulation's per-week tallies of
both scopes, the paper's Agentic population and the benchmark's, under the
TTL-only policy unchanged: `scope, ttl, hit_tokens, miss_tokens,
reusable_token_seconds, dead_token_seconds`, and the scope's
`span_seconds` and `output_tokens` from the week's
totals. It SHALL NOT hold the other eviction policies. A week the
simulation has not yet covered SHALL contribute no rows, and `weeks.json` SHALL
say so.

#### Scenario: A week without a simulation
- **WHEN** the simulation folder has no folder for week W
- **THEN** `weeks.json` SHALL mark W as not simulated, and the step SHALL still write every answer and bucket

#### Scenario: The span
- **WHEN** week W's totals give the Agentic scope a span of S seconds
- **THEN** every Agentic simulation row of W SHALL carry `span_seconds` S

### Requirement: Weeks index
`weeks.json` SHALL list every week, oldest first, as `{week, last_day,
month, simulated}`, where `month` (`YYYY-MM`) is the month of the week's
Sunday. Every page SHALL read it; the Explore page before any answer.

#### Scenario: A week that spans two months
- **WHEN** a week runs from 2026-05-31 to 2026-06-06
- **THEN** its `month` SHALL be `2026-05`

### Requirement: Harness index
`harnesses.json` SHALL list every harness of the release, most sessions
first, as `{harness, sessions, benchmark}`, where `sessions` counts its
top-level sessions over every week and `benchmark` is whether the pipeline's
population puts it in the benchmark scope. The Explore page SHALL read it, with
`weeks.json`, before any answer.

#### Scenario: The benchmark harness
- **WHEN** the release holds `eval:swe-bench` sessions
- **THEN** `harnesses.json` SHALL list `eval:swe-bench` with `benchmark: true` and every other harness with `benchmark: false`

### Requirement: Size and contents
The data folder SHALL hold only the two indexes, the
precomputed answers and the session buckets with their indexes, nothing
from the trace files and no row file, and no file larger than 25 MiB. The step SHALL
print the answers' files and size, and the buckets' count and size.

#### Scenario: Publishing what the release publishes
- **WHEN** the data folder is compared with the release
- **THEN** every value in it SHALL be a release value or computed only from release values

#### Scenario: No row file
- **WHEN** `make data` has run
- **THEN** `site/data` SHALL hold no `.parquet` file

### Requirement: Precomputed answers for the default selection
`make data` SHALL run every query under `queries/explore/` and
`queries/figures/`, and the colour orders under `queries/setup/`, over
the release's rows held as frames in memory, once
with every week and every non-benchmark harness in the selection tables,
and write each answer as `site/data/all_weeks/<page>/<query>.json`, with
the hash of each query's text in `all_weeks/queries.json`. The Explore
queries (the Overview's mixes and trends, the sessions table's, its
first page's and the trace totals') SHALL be answered with every
harness, the benchmark's marked in the table's answer, so the table can
be filtered to any harness in the browser. Every query under
`queries/explore/` SHALL be read by a page. The step SHALL print the answers' files and
size, and the Explore page SHALL draw from the answers alone.

#### Scenario: An answer equals the live query
- **WHEN** a query is run in Python with every week and the paper's harnesses selected
- **THEN** its rows SHALL equal the rows of its answer file, column for column

#### Scenario: A query file without an answer
- **WHEN** a page asks for an answer file that does not exist
- **THEN** the page SHALL show that query's error in its own place

#### Scenario: A query edited after the data was built
- **WHEN** the text of an answered query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

#### Scenario: The table's answer
- **WHEN** the sessions-table answer is written
- **THEN** it SHALL hold the benchmark harness's sessions with `benchmark` true, and the other harnesses' with it false

#### Scenario: A week without a simulation
- **WHEN** a release week has no simulation rows
- **THEN** the simulated answers SHALL still be written, from the other weeks' rows

### Requirement: Session buckets
`make data` SHALL write, for each week, the rows of every top-level
session and its subagents into `session_buckets/<week>/<xx>.json.gz`,
`xx` the first two characters of the top-level session id, as an object
from top-level id to `{tree, requests, tool_calls}`, each part
`{columns, rows}` with the columns of its query under `queries/buckets/`
less `root_session_id` (the key) and each row its values in column
order; and
`session_buckets/<week>/index.json.gz` from every session id of the week,
subagents included, to its top-level id. Both SHALL be written with
sorted keys, the queries' row order and a gzip header without a time, so
that a rebuild of the same rows writes the
same bytes; `site_data/buckets.py`'s docstring is the format's one
statement. A prefix only subagents' ids start with SHALL have an empty
bucket; a prefix no session id of the week starts with SHALL have no
file. The
bucket queries SHALL be hashed in `queries.json` as the answers' are. The
step SHALL print the buckets' count and size.

#### Scenario: A session's rows
- **WHEN** a bucket holds top-level session S
- **THEN** its `requests` rows SHALL equal `week_requests.sql`'s rows for S and its subagents, ordered by session and step

#### Scenario: The same bytes twice
- **WHEN** `make data` runs twice on the same release
- **THEN** every bucket and index SHALL be byte-identical between the runs

#### Scenario: A bucket query edited after the data was built
- **WHEN** the text of a bucket query changes and `make data` has not been rerun
- **THEN** `make test` SHALL fail naming the query

### Requirement: Trace totals answer
`make data` SHALL write `all_weeks/explore/trace_totals.json`, run like the
sessions table's answer over every week and every harness: one row with
the top-level sessions, requests, input tokens, tool calls and harnesses
of the whole trace, and how many of the harnesses are the benchmark's.

#### Scenario: The whole trace
- **WHEN** the answer is written
- **THEN** its sessions SHALL equal the Session Explorer's row count

### Requirement: The selection reaches queries as tables
The data step SHALL fill `selected_weeks` with every week and
`selected_harnesses` with every harness but the benchmark's before it
answers the figure queries, and with every harness, the benchmark's
included, before it answers the Explore queries (the Overview's mixes
and trends, the sessions table's, its first page's and the trace
totals'), and `benchmark_harness` from
`harnesses.json`; the queries SHALL read their population from those
tables and from nothing else. For the session buckets it SHALL fill
`selected_weeks` with one week at a time. The Explore page SHALL answer
every query from `data/all_weeks/`, and the Session page SHALL read its
session from a bucket; the browser SHALL fill no selection table and run
no query.

#### Scenario: The default selection
- **WHEN** `make data` answers a figure query
- **THEN** it SHALL have run with every week and every non-benchmark harness in the selection tables

#### Scenario: Changing the selection
- **WHEN** the visitor picks one month in the sessions table's drop-down
- **THEN** the table SHALL filter its answer's rows in the browser, no selection table SHALL be filled and no query SHALL run

#### Scenario: The Session page
- **WHEN** a session is opened
- **THEN** no selection table SHALL be filled and no query SHALL run

#### Scenario: An Overview query
- **WHEN** `make data` answers `explore/model_mix`
- **THEN** it SHALL have run with every harness, the benchmark's included, in `selected_harnesses`
