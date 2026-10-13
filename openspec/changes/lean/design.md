# Design: lean

## 1. Snapshot tests
`tests/snapshot.py` serves `site/` on a free port, opens twelve page
states in headless Chromium (Playwright, pinned to the version the
snapshots were written with; `make setup` installs it, `make
setup-browser` its Chromium) at 1280 px, light scheme: the landing page
with each of the six topics shown, and two fixed sessions, named as
constants in `tests/snapshot_units.py` with the reason they were chosen,
each in its Requests, Context and Timeline views: a plain session, and
a session with subagents and overlapping requests, opened by a
subagent's id so the index lookup and the expanded group are covered.
A fixed session survives every rebuild, since a week never changes once
released; the test fails with a clear message if one is missing. For
each state it writes one text file per unit under
`tests/snapshots/<state>/`: each chart's SVG outer HTML (Plot's
generated clip, marker and pattern ids normalised, one element per
line), each table's header and rows, each legend's buttons and states,
the stats strip, each card's texts (title, insight, caption, definition,
rows, range), the facts card, the request rows as markup. Colours are
recorded as CSS tokens, so a series moving to another slot is caught
and a token's value is the palette tests' job. A unit no tab changes is
read once, with its page's first state. `make test` runs the script in
compare mode and fails naming each unit whose text changed, pointing at
the file so `git diff` shows the change; `make snapshots` rewrites the
files. The test skips, saying so, when Chromium is not installed; it
fails, naming the host, when the CDN libraries or fonts cannot load,
since they are part of what is compared. A page that fails to draw
reports the browser's errors, not a locator timeout. The files are text
a maintainer can read; their size (about a megabyte) is accepted for
that.

Not covered: the narrow-width branches of the charts (every state is at
1280 px). Task 4.1 therefore keeps the unit tests that pin the narrow
ticks and labels.

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

A figure entry is `{ name, query, title, insight, caption, definition,
draw, legend? }`, and `draw` is one visible call:
`draw: (rows, body, colours) => cdfLines(rows, body, colours, { x:
"requests", series: "series", xLabel: "Requests or steps" })`. A reader
sees which kind draws the figure and with which columns, without a
table of flags. A callout the kind does not know (the ratio text of the
scope CDFs, the knee text) is a short named function in the figure's
module, called after the kind. A kind takes only parameters two or more
figures use; a figure that would need a parameter of its own keeps a
plain draw function, which is the honest form for a one-off chart. The
flags `drawsLines`, `binColumn`, `seriesColumn`, `seriesOverSameRows`,
`drawnRows`, `seriesNouns`, `isSimulation` go; thin-bin hiding and the
line of rows are the kind's, from the same parameters. Each figure is
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
of what crosses its boundary; an export's docstring states the
definition; a comment inside a function says why; nothing describes
history. A header over ten lines is reviewed, not failed: the test
lists such headers as a warning, and the reviewer decides whether every
sentence earns its place. The modules this change touches are brought
under the rule as they are edited, sentence by sentence, never by
cutting to a count; untouched modules follow when next edited.

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
