# Design: review-pass

## 1. The Overview over every harness
`site_data/answers.py` already answers `explore/sessions_of_selection`
and `explore/trace_totals` with every harness selected
(`EVERY_HARNESS_QUERIES`). The four Overview queries join them:
`explore/model_mix`, `explore/requests_per_week_by_model`,
`explore/input_tokens_per_week`, `explore/sessions_per_week_by_harness`.
The figure queries keep the paper's harnesses. The harness colour order
already covers every harness, so `swe-bench` has its colour. The two
donut captions drop "human-driven"; no other words change. The donuts'
centre counts then equal the stats strip's.

## 2. Back and the tabs
`topic_tabs.js` keeps the shown topic in history state: on mount
`history.replaceState({ topic }, "")`, on a click
`pushState({ topic }, "", "#" + topic)`, and on `popstate` the topic of
`event.state`, falling back to `topicForHash` for entries without one.
A test drives a fake `window.history` and `popstate`.

The row follows the ARIA tabs pattern: each tab has an `id`, the shown
one `tabindex="0"` and the others `-1`; ArrowLeft, ArrowRight, Home and
End move focus and show the topic; each topic section has
`role="tabpanel"` and `aria-labelledby` naming its tab; the number in a
topic heading is followed by a space and is `aria-hidden`. The row is
mounted before `weeks.json` is fetched, and the `onShow` callback catches
a failed figure import, so a click never raises an unhandled rejection.

## 3. Colours (`theme/colours.js`, `style.css`)
- `TOOL_CATEGORY_COLOURS`: one token per release category. A category
  with a tool group keeps the group's colour; the six without one (MCP,
  Subagent, Ask User, `*Packages`, `*Wait/Poll`, `*File Ops`) get tokens
  of their own, hues distinct from the seven groups' in both schemes;
  Other alone takes the grey. `toolCategoryColour` reads the map.
- `assignColours(names, firstSlot = 0)`: the harness mix and the
  harness trend start at slot 4, models at slot 0, so the two donuts do
  not open on the same blue. The setup colour orders stay as they are;
  only the slot each dimension starts from changes, and a test checks
  the first harness and the first model differ.
- `--role-system` takes a hue no token part and no time part uses; a
  node test asserts the token-part, time-part and role tokens are
  pairwise distinct, reading `style.css`.
- The palette contrast test covers the new tokens in both schemes.

## 4. The phone header
At 46rem and under, `.header-inner` wraps: the brand on the first row
(its "Agentic Dataset" kept), the nav on the second, `flex-wrap: wrap`
with no `overflow-x`, no fade and no `bringIntoRow`. `--header-height`
is not a fixed value on a phone: the header's own height sets the
sections' `scroll-margin-top` through a measured custom property, or the
sections use a value that covers two rows. The 78rem query becomes
52rem, measured against the brand (300 px) and the four links (338 px),
and its comment says so.

## 5. Keyboard and screen readers
- Table: each sortable header holds a `<button>` with the title and a
  sort mark (`↕` unsorted, faint; `▲`/`▼` sorted); `th` carries
  `aria-sort`. Enter and Space sort.
- Charts: `renderFigure` and the donut and trend cards set
  `role="img"` and `aria-label` = "<title>: <insight>" (the trends and
  donuts: title and caption) on the drawn SVG, in `charts.js` after each
  draw.
- Legends: `mountLegend` gives the row `role="group"`, one button
  `tabindex="0"` and the rest `-1`, with ArrowLeft/ArrowRight moving
  focus; Enter and Space toggle as today.
- `aria-current="true"` on the Session page's marked link.
- Session page: the view titles are `h2`; the footer's "On this site"
  and "Elsewhere" are `<p>` with the nav's `aria-label`, not headings.
- `:focus-visible` is a 2 px ring in the accent on buttons and links.

## 6. The Session Explorer's first page
A new query, `explore/sessions_first_page.sql`: the 20 newest top-level
sessions over every harness (the table's default sort), the same columns
as `sessions_of_selection`, plus `total_sessions`, the count over every
harness, on every row. `answers.py` answers it with every harness.

`sessions_table.js` draws the first page from it at once when the URL
asks for the default view (no filter, sort or page key), then fetches
`sessions_of_selection` and swaps the full rows in; the controls are
disabled until then. With any key in the URL it waits for the full
answer as today. The count line reads `total_sessions`.
`queries.json` hashes the new query; `make data` reruns.

## 7. Charts
- `api_cost_by_ttl`: the output part joins the legend
  (`API_LEGEND_ORDER`), or is not drawn; the former, since the rows hold
  it.
- `calls_per_request_by_category`: bars from zero.
- `hit_ratio_cdf_by_gap_bin`: the two line labels sit beside the line
  ends, off the lines.
- The scope CDFs: the ratio ("34.4× longer") is a text annotation in
  the chart's corner, not a legend entry.
- Trends: the chart takes the body's width and a height that leaves no
  gap under the legend; ticks on every month, May and September
  included (`timeTicks` from the weeks' range).
- `subagents_per_session`: bin edges as tick labels.
- Donut legends: one column under 30rem.
- `.bibtex pre`: `white-space: pre-wrap; overflow-wrap: anywhere`.

## 8. The start module for one page
`startPage({ sections, figureSections, showWeekCount })` loses `file`
(`index.html` is the page; `layout.js` keeps the one constant) and the
null checks for `#selection` and `#topic-tabs`; `askSessionsPerWeek` and
`readsSessionsPerWeek` go, the query is asked once a run as before the
split; `figure_sections.js` reads `FIGURE_SECTIONS` itself again. The
header comment describes one page. `SECTIONS` in `layout.js` becomes
`LINKED_SECTIONS`. `pageTopics` reads the heading's text node and is
private. One `mountScrollingRow(row)` in `shared/table.js` serves the
table's row and any other; the header no longer scrolls. One
`[hidden] { display: none !important; }` replaces the two per-class
rules. `:not(.brand)` goes. The footer line's count is `weeks.length`
in digits, written once `weeks.json` is read (`renderFooter(container,
carried, weekCount)`; "Weeks" while unknown), so the footer and the hero
agree. Comments and test names that describe the three pages or the old
header follow.

## 9. Not changed, on purpose
- Provider letters keep the release's letters (A–F, H): re-lettering
  would break parity with the paper and the dataset. The definition of
  the provider figure says the letters are the dataset's.
- The month filter kept "the weeks whose Sunday falls in the month" when
  this design was written; that was decided separately afterwards and is
  §10: a month now keeps the sessions that started in it.
- No sentence of the figures, the hero, the footer or the guide line is
  rewritten.

## 10. The month filter by the session's start
A month keeps the sessions whose start (`first_start_ms`, in UTC) falls
in that calendar month. Until now `rowsInFilter` in
`site/js/explore/sessions_filter.js` kept the rows whose week's Sunday
falls in the month, so "May 2026" listed a session started June 6 (in the
week of May 31), and there was no September though the data run to
September 5.

The month drop-down lists every calendar month from the first week's
Sunday to the last week's Saturday, oldest first, "All months" first as
today: May, June, July, August and September 2026 for the current data.
`monthsOf(weeks)` changes accordingly. A `weeks=` key in the URL still
maps to the months its weeks fall in (reading old links), and
`months=<YYYY-MM>` stays the written key. The count line and everything
else stay as they are; no sentence shown on the page changes.
`tests/explore_sessions_filter.test.js` covers a session at a week's end
(started June 6 in the week of May 31 is in June, not May) and the
September option. `weeks.json` holds each week's Sunday and Saturday,
which is all the months need, so the Python side is unchanged.

