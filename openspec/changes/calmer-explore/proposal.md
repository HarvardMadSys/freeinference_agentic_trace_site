# Proposal

## Why

The Explore page asks too much of a visitor before it shows anything. The
picker lists sixteen weeks, four months, an all-weeks pill, fourteen
harnesses and two notes; the Prefix-caching section ends in three
simulation figures that compare four eviction policies the paper itself
only uses in one aside; the type is small for a page that is mostly
charts; and opening a session makes about thirty-five HTTP range requests
on four files for one session's rows. A tool call's details stop at its
name and category, where the release knows which programs a shell call
ran.

## What Changes

- **The picker folds away and chooses months.** The selection card shows
  one line, the selection in words, with a control that opens the choices.
  The choices are months and harnesses; weeks are no longer picked one by
  one. The URL key becomes `months`; the old keys are still read.
- **One simulation figure: prefill against storage.** The paper's
  Pareto view, normalised prefill against mean retained tokens with a point
  per TTL, replaces the simulated hit ratio by TTL, retained over active
  and dead over active by policy. The site data keeps the TTL-only
  policy's tallies only, with each week's span.
- **The Session page reads its week whole.** Before its queries it fetches
  the week's four row files, one request each, into DuckDB's memory.
- **Larger type.** The base size and the smallest sizes go up, on every
  page.
- **Tool calls carry their programs.** The site data keeps the release's
  `programs`, and the Session page shows them for each call, in the
  details table and the chip's tooltip.

## Impact

- `week-selection`: choosing months replaces choosing weeks; the URL key;
  the folded picker.
- `explore-page`: the Prefix-caching figures.
- `session-page`: the week is loaded whole; programs in the details.
- `site-data`: tool calls gain `programs`; the simulation rows hold one
  policy and the span.
- `site-repository`: a type-size requirement.
- The data is rebuilt and committed with the change (`ship-the-data`).
