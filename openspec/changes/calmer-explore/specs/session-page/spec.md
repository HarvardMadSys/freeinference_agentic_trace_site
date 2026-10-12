# Spec Delta

## Purpose

A session opens with one request per file, and its tool calls name their
programs and the shape of their arguments.

## MODIFIED Requirements

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

### Requirement: Requests view
The Requests view SHALL list the requests in start order, one row per
request. Each row SHALL show:
- a label: "Turn N" for a user step, "↳ step S" for a tool step;
- the elapsed time since the session's first request, as `+MM:SS–MM:SS`;
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
