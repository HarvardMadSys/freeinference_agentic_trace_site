# Design

Every module follows the repository's rules (`site-repository`).

## The folded picker

A native disclosure (`<details>` with a `<summary>`) needs no script to
open and close and is read by screen readers. Its summary is the selection
in words: "Every week, May to August 2026 · the paper's harnesses", or
"July 2026 · codex, hermes". Open, it shows one pill per month, labelled
with the month's name and its weeks' count, "All months", then the harness
pills and their two buttons as now, then the notes. The picker opens by
itself when the URL's selection is not the default, so a visitor who
follows a shared link sees what was chosen.

The selection stays a list of weeks inside the page and in the selection
tables, so every query, answer and test is untouched; a month is the weeks
whose Sunday falls in it, the rule `weeksByMonth` already applies. The URL
writes `months=<YYYY-MM>,…`; `month=`, `weeks=` and `scope` are read as
before (a listed week selects its month) and rewritten.

## Prefill against storage

The paper's definition, from the simulation's tallies summed over the
selected simulated weeks under the TTL-only policy:

- mean retained tokens: reusable plus dead token-seconds over the span
  (the weeks' `span_seconds` summed);
- normalised prefill: missed tokens over the missed tokens with no TTL.

One point per TTL, labelled with the TTL (∞ for none), on log axes, joined
in TTL order; a tooltip gives the TTL and both values. The paper's
`numbers.json` holds the normalised prefill of five TTLs and the retained
tokens of three, which the parity test compares with the default
selection. The other three policies leave the site data: nothing draws
them, and the simulation files shrink to a quarter.

## The Session page's week

DuckDB reads a Parquet file over HTTP a range at a time: the footer, then
each column chunk of each row group a query touches, and the Session page
runs five queries over four files, hence about thirty-five range requests
for one session. The Explore page already swaps a fetched file into
DuckDB's memory (`swapFileToMemory`); the Session page uses the same swap
for its week's four files before its queries, so each is one request and
the queries read memory. A file whose fetch fails stays on HTTP ranges.
The measured request count and time, before and after, go in `tasks.md`.

## Type

The base size goes from 16 px to 18 px; the smallest text (captions,
notes, pills, table cells, tick labels) rises so that nothing renders
under 14 px. Headings keep their ratios. The 360-pixel layout is checked
after the change.

## Programs

The release's `programs` is a list of program labels per shell call, in
the command's order (`nc, echo, echo`), null for other calls. It is kept
as is, as a list column; the details table shows it joined by commas, the
chip's tooltip adds it after the category. The arguments skeleton stays
out: it is a long string per call and would double the tool-call files.
