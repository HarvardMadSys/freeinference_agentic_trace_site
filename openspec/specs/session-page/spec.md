# session-page Specification

## Purpose
One session, opened from the sessions table or from a shared link. It shows
how the session's context grew and was cached, where its time went, which
tools it called and which subagents it spawned. The release holds no message
text, so the page shows a session's structure, never its content.

## Requirements

### Requirement: Opening a session
The Session page SHALL open at `session.html?week=<sunday>&id=<session_id>`,
optionally with `&step=<step>` and `&view=requests|context|timeline`
(`requests` by default).
- Before its queries it SHALL fetch the week's row files whole, one request
  per file, into DuckDB's memory, so the queries read memory; a file whose
  fetch fails SHALL be read over HTTP ranges instead.
- It SHALL read only the rows of that session and of its subagents, at every
  depth, through `selected_session`.
- An id that is not a top-level session of that week SHALL show "session not
  found in this week".
- A subagent's id SHALL open its top-level session with the subagent's group
  expanded.

#### Scenario: One request per file
- **WHEN** a session of week W is opened on a server that answers range requests
- **THEN** each of W's four row files SHALL be requested once, in full, and no range of them afterwards

#### Scenario: A shared link to a step
- **WHEN** a visitor opens `session.html?week=2026-08-09&id=S&step=12`
- **THEN** the page SHALL open the Requests view, scroll to step 12 and highlight it

#### Scenario: A subagent's id
- **WHEN** the id is a subagent session
- **THEN** the page SHALL show its top-level session with that subagent's group expanded and scrolled into view

### Requirement: Session facts
The Session page SHALL show a stat strip with:
- harness and models (each with its number of requests);
- started time (UTC) and duration;
- turns and requests, the top-level session's and its subagents' given
  apart;
- subagents and tool calls;
- input, cached and output tokens, and the cached share of input.

A link SHALL return to the Explore page's sessions table with the selection,
sort, filters and page the visitor came from.

#### Scenario: A session with subagents
- **WHEN** the session spawned three subagents that made 40 requests in all
- **THEN** the strip SHALL count three subagents and give the 40 requests apart from the top-level session's own

#### Scenario: Back to the table
- **WHEN** the visitor opened the session from the table sorted by duration on page 2
- **THEN** the back link SHALL open the Explore page at the sessions table, sorted by duration, on page 2

### Requirement: Requests view
The Requests view SHALL list the requests in start order, one row per
request. Each row SHALL show:
- a label: "Turn N" for a user step, "↳ step S" for a tool step;
- the elapsed time since the session's first request, from the request's
  start to its end, in minutes and seconds (`0:07–0:12`), and in hours,
  minutes and seconds from an hour on (`1:00–1:02:04`);
- a horizontal bar of the request's input split into cached and uncached,
  then its output, in three fixed colours, scaled to the largest request in
  the session;
- a chip for each tool call the request emitted, coloured by category,
  whose tooltip gives its name, category, programs when it has them, and
  outcome.

Subagents:
- Each subagent session SHALL appear as a collapsed group header under the
  row of the step that spawned it. The header SHALL give the subagent's
  requests, duration and tokens.
- Clicking the header SHALL expand the subagent's requests, indented.
- "Expand all" and "Collapse all" SHALL act on every group.

Requests whose start-to-end intervals overlap SHALL be joined by a bracket
in a left gutter.

Clicking a row SHALL open its details:
- input tokens by role (system, user, assistant, tool results, tool
  definitions);
- TTFT and duration;
- finish reason;
- its transition (append, mutation, switch) and cause;
- what it waited for and for how long;
- each tool call with its name, category, programs (a shell call's, in
  the command's order, joined by commas; blank for other calls), outcome,
  latency and result tokens, and under it, in monospace, its arguments
  skeleton: the command with every value replaced by its type for a shell
  call, the argument names and value types for any other.

#### Scenario: A shell call's programs
- **WHEN** the visitor opens the details of a request whose shell call has the programs `nc`, `echo`, `echo` and the command skeleton `nc -z -w <num> <path> <num> && echo <str> || echo <str>`
- **THEN** that call's Programs cell SHALL read `nc, echo, echo`, and the line under it `nc -z -w <num> <path> <num> && echo <str> || echo <str>`

#### Scenario: A native call's arguments
- **WHEN** the details show an `apply_diff` call
- **THEN** its Programs cell SHALL be blank and the line under it SHALL read `path: <path>, diff: <path>`

#### Scenario: Expanding a subagent
- **WHEN** the visitor clicks the group header under step 5
- **THEN** the subagent's requests SHALL appear indented below it, each with its own bar

#### Scenario: Parallel requests
- **WHEN** two subagents' requests ran over overlapping intervals
- **THEN** a bracket in the gutter SHALL join their rows

### Requirement: Context view
The Context view SHALL plot, against elapsed time since the session's first
request:
- the top-level session's input per request, as a stacked area of cached
  and uncached tokens;
- one context-trajectory line per agent: the top-level session in one
  colour and each subagent in another, each line being that agent's input
  tokens per request.

A switch SHALL instead split the stacked area by role. Each turn's start and
each request whose transition is a mutation or a switch SHALL be marked.
Clicking a point SHALL open that request in the Requests view.

#### Scenario: A context mutation
- **WHEN** step 12's transition is `mutation`
- **THEN** the chart SHALL mark step 12, and its tooltip SHALL name the transition and its cause

### Requirement: Timeline view
The Timeline view SHALL draw a Gantt chart with one row per agent: the
top-level session first, then each subagent in spawn order. Over elapsed
time, each row SHALL show:
- each request split into time to first token and the rest;
- each tool call as a bar that starts at its request's end, lasts its
  latency, and is coloured by category;
- each wait before a request, coloured by what it waited for.

The caption SHALL say that a tool call's start is taken as its request's
end. Clicking a bar SHALL open that request in the Requests view.

#### Scenario: A long user wait
- **WHEN** a request waited 20 minutes for the user
- **THEN** the gap before it SHALL be drawn as a user wait, and its tooltip SHALL give the duration
