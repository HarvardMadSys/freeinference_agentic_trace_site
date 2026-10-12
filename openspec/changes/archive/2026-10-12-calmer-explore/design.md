# Design

Every module follows the repository's rules (`site-repository`).

## Frozen figures

The answers under `site/data/all_weeks/` already hold every figure,
trend, headline number and distribution for the default selection, and
the default page already draws from them alone. This change makes that
the only path the page takes: one named constant, `FIGURES_ARE_FROZEN`
in the Explore page's module, true, draws every section from its answer
file, mounts no week or harness picker and starts neither DuckDB nor the
stream; false restores the previous behaviour, which stays in the code and
its tests so it can be turned back on. `STREAM_ROWS_AFTER_DRAW` is set to
false. The queries and the selection tables
stay as they are for `make data`, which fills them once with every week
and the paper's harnesses; nothing in the browser fills them any more
except the Session page's `selected_session`. The Explore page's time to
draw stays what it is (under a second) and its transfer falls from about
68 MB to under 2 MB per visit. Measured with the switch on when it was
turned on, before the figures were added (headless Chromium, `serve.py`,
which does not compress): a visit to `/` makes 127 requests and transfers 5.3 MB, 4.2 MB of it the sessions table's answer,
with no `.wasm` and no `.parquet`; gzipped, as a static host serves JSON,
its own files come to 0.94 MB, plus 0.34 MB of chart libraries.

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
  and dead token-seconds over the span), one point per TTL (the TTLs the paper names labelled, every point named in its tooltip) under
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
- **speed-up if twice as fast**: from per-session time parts like the
  session-time figure's, with model time split into prefill and decode (a
  request without a trusted TTFT shared out by its session's prefill ratio)
  and each tool wait capped at the pipeline's 15 minutes, the speed-up of
  the sessions' machine time when prefill, decode or tool time alone is
  halved.
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

## The look

A reviewer with an eye for design goes through every page before the
figures are touched and writes what to change, against three rules: a
figure card shows a title and one short caption, with its definition and
row count behind a small control; a chart carries no text its axes and
legend already give; spacing, card sizes and type are the same from one
card to the next. The findings are applied as one task, and the reviewer
looks again at the end.

## The Session page's week

DuckDB reads a Parquet file over HTTP a range at a time: the footer, then
each column chunk of each row group a query touches, and the Session page
runs five queries over four files, hence about thirty-five range requests
per session. The page now fetches its week's four files whole, one request
each, and registers each as a buffer before its queries, so they read
memory; a file whose fetch fails is read over HTTP ranges instead.
Measured on the largest session (5,040 requests, week of 2026-08-30) with
the local range server and headless Chromium, to the Requests view drawn:
before, 30 requests to `data/`, 27 of them ranges, 7.5 MB, 3.5 s (8.3 s
with 40 ms latency and 50 Mbit/s throttled, the DuckDB library included);
after, with the first file downloading while DuckDB starts and the other
three one after another once it is up and the file before is swapped in,
17 requests, 10.9 MB, 3.6 s (7.3 s throttled). Ten of those requests are ranges, a few
kilobytes each: the opener's reads of each file's size and footer, which
remain because the opener makes the views over the files' URLs before any
file's bytes arrive, so that a file whose fetch fails is still read; no
query reads a range once the files are in memory.

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
week raw with a median of 67 characters and a third repeated. Measured on
the week of 2026-08-23 (163,587 calls, written as the data step writes
it), the two columns take the week's tool-call file from 0.99 MB to
3.01 MB, so the sixteen weeks' tool-call files grow from 7.8 MB to about
24 MB, about 3 MB a week.

## Verification

Measured at the end of the change on the shipped data (16 weeks, every one
simulated; 125 files, 88.8 MB), with headless Chromium against `serve.py`
on the same machine, three runs each. The Explore page draws every trend,
headline number, distribution card, the 29 figures and the session list in
1.0–1.2 s (median 1.0 s), with a clean console. It makes 149 requests: 97
to the site, among them 57 data files (`weeks.json`, `harnesses.json` and
55 answers), and 52 to the CDN; no `.wasm` and no `.parquet`. The site's
own files are 5.1 MB uncompressed, 4.0 MB of it the session list's answer;
gzipped at level 6, as a static host would send them, 1.0 MB (the data files
0.89 MB, the session list's answer 0.79 MB), plus 0.34 MB of chart library and
fonts as the CDN sends them: 1.3 MB per visit (5.9 MB uncompressed, the
libraries included), against about 68 MB with the stream. The Session page opens the largest session's Requests view in
3.5–3.6 s (8.0 s at 40 ms and 50 Mbit/s): 123 requests, 17 to `data/`
(three JSON files, the week's four files whole, 13.5 MB with the
skeletons, and ten range reads of 1 byte to 16 kB), and 6.8 MB of
DuckDB-WASM and the other libraries from the CDN. The sixteen weeks' tool-call files, with programs
and skeletons, total 21.4 MB.
