# Spec Delta

## Purpose

The Session page shows its facts as one card, names three token parts,
and lets the visitor narrow the time range of the Context and Timeline
views.

## MODIFIED Requirements

### Requirement: Session facts
Beside the title, one card SHALL list the session's facts as labelled
fields in two columns: harness; models, each with its requests; started
(UTC); duration; turns; requests; subagents; tool calls; input tokens;
cached share with the cached tokens; output tokens. A link SHALL lead back
to the Explore page's session list with its state.

#### Scenario: A session with subagents
- **WHEN** a session has three subagent sessions
- **THEN** the subagents field SHALL read 3 and the requests field SHALL count the top-level session's own requests

#### Scenario: Back to the table
- **WHEN** the visitor follows the back link
- **THEN** the Explore page SHALL open at the session list with the same filters, sort and page

### Requirement: Requests view
The Requests view SHALL list the requests in start order, one row per
request. Each row SHALL show:
- a label: "Turn N" for a user step, "↳ step S" for a tool step;
- the elapsed time since the session's first request;
- a horizontal bar of the request's cached input, uncached input and
  output, in three fixed colours, scaled to the largest request in the
  session; a request whose provider reports no cache reads SHALL count
  its whole input as uncached, and no fourth part SHALL be drawn or named;
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
- each tool call with its name, category, programs, outcome, latency and
  result tokens, and under it, in monospace, its arguments skeleton.

#### Scenario: A shell call's programs
- **WHEN** the visitor opens the details of a request that ran `nc -z host 80 && echo up || echo down`
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

#### Scenario: No cache report
- **WHEN** a request's provider reports no cache reads
- **THEN** its bar SHALL show its input as uncached and its output, and the legend SHALL name only cached input, uncached input and output

### Requirement: Context view
The Context view SHALL draw the top-level session's input tokens over
elapsed time, split into cached and uncached (a request with no cache
report counted as uncached) or by role, with each subagent's trajectory as
its own line, mutations as dots and turn starts as dotted rules; a tooltip
gives the request's parts. Under the chart a range slider with two handles
over the session's elapsed time SHALL set the view's time range and
redraw it, with ticks computed for the range.

#### Scenario: A context mutation
- **WHEN** a request's transition is a mutation
- **THEN** a dot SHALL mark it on its agent's line, and the tooltip SHALL name the cause

#### Scenario: Narrowing the time range
- **WHEN** the visitor drags the slider's handles to the session's second hour
- **THEN** the chart SHALL redraw over that hour only, with ticks for it, and the slider SHALL keep its handles where they were put

### Requirement: Timeline view
The Timeline view SHALL draw one row per agent with a bar per request
over elapsed time, coloured by what the request waited for, with the
tooltip and click of the Requests view; under it the same range slider as
the Context view SHALL set the time range and redraw.

#### Scenario: A long user wait
- **WHEN** a user turn follows a gap of an hour
- **THEN** the gap SHALL be drawn in the user-wait colour between the two bars

#### Scenario: Narrowing the time range
- **WHEN** the visitor narrows the slider to one hour of a day-long session
- **THEN** only the bars within that hour SHALL be drawn, clipped at the range's edges
