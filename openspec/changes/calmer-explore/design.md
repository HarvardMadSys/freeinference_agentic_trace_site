# Design

Every module follows the repository's rules (`site-repository`).

## Frozen figures

The answers under `site/data/all_weeks/` already hold every figure,
trend, headline number and distribution for the default selection, and
the default page already draws from them alone. This change makes that
the only path: `runQuery` on the Explore page reads an answer file, and the
code that fills selection tables, starts DuckDB, streams files and defers
figures until they are in view goes. The queries and the selection tables
stay as they are for `make data`, which fills them once with every week
and the paper's harnesses; nothing in the browser fills them any more
except the Session page's `selected_session`. The Explore page's time to
draw stays what it is (under a second) and its transfer falls from about
68 MB to under 2 MB per visit.

## The sessions table's filter

The table's answer gains the benchmark's sessions, with the `benchmark`
flag beside the harness, and the filter is a month choice, a harness choice
and the search box, applied to the rows in the browser; the default is
every month and the paper's harnesses. It is a folded disclosure above the
table, one line in words when closed. A month is the weeks whose Sunday
falls in it. `months` and `harnesses` in the URL set it and nothing else;
the Session page carries them back; `month=`, `weeks=` and `scope` from
older links are read and rewritten.

## The figures added

Each is one query over the site data and one chart, answered at
`make data` like the others, with a parity test where the paper's
`numbers.json` holds its numbers:

- **prefill against storage** (both scopes): normalised prefill (missed
  tokens over those with no TTL) against mean retained tokens (reusable
  and dead token-seconds over the span), one labelled point per TTL under
  the TTL-only policy, human-driven and benchmark as two curves on log
  axes. The simulation rows gain the benchmark scope and the span.
- **API cost and infrastructure cost per TTL**: the paper's sums at its
  prices (uncached, cached and output per million tokens; recompute per
  million and storage per million token-days), each as a multiple of its
  total at a one-minute TTL, stacked by part; the prices are mirrored
  constants tied to the pipeline's by a mirror test, as the cost share's
  already are. The knee and the minimum are marked.
- **tool mix along a turn** (both scopes): per tenth of a turn, the share
  of calls in each of the paper's eight groups; the group of a `*File
  Ops` call depends on its programs, so the group rule and its two program
  sets are mirrored from the pipeline and tested.
- **calls per request by category**: the mean number of calls of the
  requests whose first call is of the category.
- **latency by batch width**: the quantile band of the tool wait of
  requests by how many calls they made, and the serial line.
- **speed-up if twice as fast**: from the same per-session time parts as
  the session-time figure, the session-time speed-up when prefill, decode
  or tool time alone is halved.
- **human-driven against benchmark**: four CDF pairs, turn duration,
  session duration, input per request and user prompt tokens, each with
  both medians and their ratio. User prompt tokens is a per-request column
  the data step computes with the pipeline's function.
- **context mutations by cause** (a table): per transition and cause, the
  share of steps, of sessions and of the prefill under infinite retention.
  The last needs each request's missed tokens with no TTL, which the data
  step joins from the simulation's per-request misses as one integer
  column of `requests`.

Not drawn, because the public pipeline does not compute them: the
subagent straggler figures and the user-intent figures, which rest on
labels the release does not carry.

## The Session page's week

DuckDB reads a Parquet file over HTTP a range at a time: the footer, then
each column chunk of each row group a query touches, and the Session page
runs five queries over four files, hence about thirty-five range requests
per session. The page now fetches its week's four files whole, one request
each, and registers each as a buffer before its queries, so they read
memory; a file whose fetch fails is read over HTTP ranges instead. The
measured request count and time, before and after, go in `tasks.md`.

## Type

The base size goes from 16 px to 18 px; the smallest text (captions,
notes, pills, table cells, tick labels) rises so that nothing renders
under 14 px. Headings keep their ratios. The 360-pixel layout is checked
after the change.

## Programs and argument skeletons

The release's `programs` is a list of program labels per shell call, in
the command's order (`nc, echo, echo`), null for other calls; its
`arguments_skeleton` is the call's arguments with every value replaced by
its type. Both are kept as they are. The details table shows the programs
joined by commas and, under each call in monospace, the skeleton: a shell
call's command, any other call's `name: <type>` pairs; the chip's tooltip
adds the programs after the category. The skeletons are 14 MB of text per
week raw with a median of 67 characters and a third repeated; the
tool-call files' size is measured when the data is built.
