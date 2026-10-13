# Design: lean

## 1. Snapshot tests
`tests/snapshot.py` serves `site/` on a free port, opens the nine page
states of `simplify`'s gate in headless Chromium (Playwright, from
`make setup-browser`), and for each state computes one SHA-256 per
unit: each chart's SVG outer HTML (Plot's ids normalised), each table's
header and rows, each legend's buttons and states, the stats strip, each
card's four texts, the facts card, the request rows. The checksums are
written to `tests/snapshots/<state>.json`, keyed by the unit's id or
title. `make test` runs the script in compare mode and fails naming each
unit whose checksum changed; `make snapshots` rewrites the files. The
test skips, saying so, when Chromium is not installed. The nine states
and the session used are constants at the top of the script, and the
session's id is read from the bucket index so a data rebuild does not
break it. Checksums, not the markup, so the files stay small and a diff
says what changed, not how.

## 2. Chart kinds
`js/charts/` holds one module per kind, each exporting
`draw(rows, body, colours, options, hidden)` and, where the kind has
series, `legend(rows, colours, options)`:
- `cdf.js`: lines of share against value, log or linear x, optional
  median labels and a reference line.
- `week_bars.js`: stacked bars per week, series folded past eight.
- `ranges.js`: a box of two quantiles with whiskers per category.
- `histogram.js`: bins and counts, the existing one moved.
- `ranked.js`: stacked areas over sessions ranked by a share.
- `knee_lines.js`: cost against retention with a marked knee.
- `donut.js`: the Overview's donut, moved from `landing/arcs.js`.

A figure entry is `{ name, query, kind, options, title, insight,
caption, definition, annotate? }`. `options` names the columns and
labels the kind needs (`x`, `y`, `series`, `seriesLabels`, `xLabel`,
`yLabel`, `ticks`); `annotate(plot, rows)` adds a callout the kind does
not know (the ratio text of the scope CDFs, the knee text). The runner
calls `kinds[entry.kind].draw(...)` and `.legend(...)`. The flags
`drawsLines`, `binColumn`, `seriesColumn`, `seriesOverSameRows`,
`drawnRows`, `seriesNouns`, `isSimulation` go; thin-bin hiding and the
line of rows read `options.series` and the kind. Each figure is
converted one at a time, the snapshot test green after each, so a
visitor sees no change. `shared/charts.js` keeps the frame, the tooltip
style, the colour scale and the width; `axes/ticks.js` stays.

## 3. One URL format
`sessions_filter.js` reads and writes `months`, `harnesses`, `model`,
`min`, `search`, `sort`, `page` only; `weeks=`, `month=`, `scope=`,
`weeks=all`, the unknown-week note and the old anchors' redirect in the
Overview go, with their tests. A key the data cannot satisfy is
ignored, as today.

## 4. The comment rule
CONTRIBUTING: a module header says what the module holds and the shape
of what crosses its boundary, in at most eight lines; an export's
docstring is one to three lines stating the definition; a comment
inside a function says why, in one line; nothing describes history. A
node test counts header lines. The modules this change touches are
brought under the rule as they are edited; untouched modules follow
when next edited.

## 5. The specs
After this change is archived, by hand in one commit: `site`
(repository, data, deployment, look), `explore-page` and `session-page`;
each requirement moved verbatim; `week-selection`'s one requirement
folded into the sessions table; the rules that restate CONTRIBUTING
dropped; `openspec/changes/archive/` deleted; `openspec validate --specs
--strict` green.

## 6. Order
Snapshots first, because they make the rest safe; then the URL format
(small, proves the snapshots); then the kinds, one figure family per
task; then the markup tests removed; then the rule and the pass; then
the squash.
