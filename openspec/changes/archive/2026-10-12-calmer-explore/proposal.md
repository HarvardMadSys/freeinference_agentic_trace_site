# Proposal

## Why

The Explore page asks too much of a visitor. It opens on a picker of
sixteen weeks and fourteen harnesses, computes every figure again in the
browser when any of them changes, and streams 66 MB of row files into
memory on every visit so that those recomputations are fast. The figures
are the paper's, over the paper's data; nobody needs them recomputed for
August alone. What a visitor does need to narrow is the sessions table,
to find a session to open.

The page also ends its Prefix-caching section in three simulation figures
of eviction policies the paper mentions in one aside, the type is small
for a page of charts, the Session page makes about thirty-five range
requests to show one session, and a tool call's details stop at its name
and category where the release knows the programs a shell call ran and
the shape of every call's arguments.

## What Changes

- **The figures are frozen to the dataset.** Every figure, trend,
  headline number and distribution card is drawn from the answers
  `make data` precomputes over every week and the paper's harnesses, and
  from nothing else. The week and harness pickers go, with the browser's
  recomputation, the row stream and the lazy drawing out of the page. The
  Explore page never loads DuckDB. The browser query path (the engine,
  the selection tables, the stream, the pickers) stays in the code behind
  one switch, off, so it can be turned back on. Legends still hide and
  show series.
- **The filter moves to the sessions table.** The table at the bottom
  gets a month and harness filter, with the search it has, applied in the
  browser to the sessions answer, which now holds every harness's
  sessions with the benchmark marked. The filter lives in the URL as
  `months` and `harnesses` and reaches nothing else.
- **More of the paper's figures.** Prefill against storage, with the
  benchmark's curve beside the human-driven one; API cost and
  infrastructure cost per TTL; the tool mix along a turn, human-driven and
  benchmark; calls per request by category; latency by batch width; the
  session-time speed-up if one part ran twice as fast; the four
  human-driven against benchmark CDFs; and the context-mutation table.
  The three policy figures go.
- **The Session page reads its week whole**, one request per file, and
  shows each tool call's programs and the skeleton of its arguments.
- **Larger type** on every page.

## Impact

- `week-selection`: the week, harness and streaming requirements are
  removed; a sessions-table filter requirement replaces them.
- `explore-page`: the figures are drawn from answers; the figure list;
  the sessions table's filter.
- `session-page`: the week loaded whole; programs and skeleton.
- `site-data`: tool calls, the simulation rows (both scopes, one policy,
  the span), the cheaper-reads sums are not needed, a request's missed
  tokens with no TTL, user prompt tokens, every answer.
- `site-repository`: a type-size requirement; the browser query path kept
  behind a switch.
- **A tidier look.** An aesthetic review of every page, then its
  findings applied: figure cards with a title and one short caption, the
  definition and row count behind a control, less text on the charts,
  consistent spacing.
- The data is rebuilt and committed with the change.
