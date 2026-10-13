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
- `stacked_bars.js`: stacked bars over a named x column (the weeks, or
  the input-size bins), series folded past eight.
- `ranges.js`: a box of two quantiles with whiskers per category.
- `histogram.js`: bins and counts, the existing one moved.
- `ranked.js`: stacked areas over sessions ranked by a share.
- `knee_lines.js`: cost against retention with a marked knee.
- `donut.js`: the Overview's donut, moved from `landing/arcs.js`.

A figure entry is `{ name, query, title, insight, caption, definition,
draw, legend?, isWide? }` plus the fields that describe its rows, and `draw` is
one visible call:
`draw: (rows, body, colours) => drawCdf(rows, body, colours, { xLabel:
"Requests or steps", ... })`. A reader sees which kind draws the figure
and with which labels, without a table of flags. A callout the kind does
not know (the ratio text of the scope CDFs, the knee text) is a short
named function in the figure's module, passed to the kind's `callout`
hook, which receives what the kind drew (the rows and the medians). A
kind takes only parameters two or more figures use, with two named
exceptions: a kind kept whole may take a one-figure parameter when the
alternative is a near-copy of the kind (the histogram's `ticks`, the
donut's `labels`), and frame sizes (`weeks`, `margins`, the CDF's
`height`) are plain sizes, not behaviour. A figure that would need more
keeps a plain draw function, built from the kind's exported helpers
where they fit, which is the honest form for a one-off chart; the
survey found thirteen such figures. A kind imports only from `shared/`,
`axes/` and `theme/`; the series helpers live in `shared/series.js`.

Thin-bin hiding and the line of rows stay in the runner, because the
counting rules vary by figure, not by kind. After 3.3 an entry keeps
the fields that describe its rows: `binColumn` (a column, or null when
every row is its own bin), `seriesColumn`, `seriesOverSameRows`,
`seriesNouns`, `drawnRows`, `drawsLines` (which picks the legend's
swatch), and `readsSimulation` (formerly `isSimulation`); a histogram
declares its `statsQuery`, which is what the runner checks. The week
bars kind generalises to stacked bars over a named x column
(`stacked_bars.js`, `xColumn`, `weeks` and `margins` optional), so the
input-share bars call it too and `drawBars` leaves `shared/charts.js`.
The transition CDF calls the CDF kind with a `height`; the gap-bin CDF
keeps a plain draw. Every CDF now clips only its lines, so a tooltip and
a median rule are no longer cut at the plot's edge. That is a deliberate
visible change, recorded here and shown in the snapshot diff of three
figures alone: the gap-by-cause, the transition and the gap-bin CDFs.

## 3. One URL format
The sessions table reads and writes `months`, `harnesses`, `model`,
`min_requests`, `search`, `sort`, `direction`, `page` only, and leaves
any other key as it is; `weeks=`, `month=`, `scope=`,
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
