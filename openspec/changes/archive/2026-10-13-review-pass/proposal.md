# Change: review-pass

## Why
A design review and a code review of the one-page site found what a
visitor hits first: the Overview's donuts and trends leave the benchmark
replay out while the stats strip counts it; the browser's Back does not
return to the previous Insights topic when the page was opened on
another anchor; one chart draws a series its legend does not list; the
same colour means different things in neighbouring charts; the phone
header hides two of its four links; the Insights tabs, the table's sort
and the legends do not work from the keyboard, and no chart has a name
for a screen reader; the Session Explorer fetches all 12,002 sessions
before it shows 20; several charts are hard to read; and the shared
start module keeps the generality of the three-page site.

## What changes
- **The Overview counts every harness.** The two donuts and the three
  weekly trends are answered over every harness, the benchmark's too,
  as the stats strip and the Session Explorer are; `swe-bench` is one
  harness among the others. The Insights stay the paper's population.
- **Back returns to the previous topic** from any anchor the page opened
  on: the shown topic is kept in history state.
- **Every drawn series is in its legend.**
- **Colours.** Grey is Other and nothing else: every tool category has a
  colour of its own, the same in every chart. Harnesses and models take
  the series colours from different starting slots, so the largest
  harness and the largest model are not both blue. No role shares a hue
  with a token part.
- **The phone header** shows the brand on one row and the four links on
  a second, wrapping; nothing scrolls sideways or fades. The two-row
  breakpoint of the wide header follows the links it now has.
- **Keyboard and screen readers.** The tabs follow the ARIA tabs pattern
  (arrow keys, Home, End, one tab stop, tab panels); each sortable column
  header is a button with its sort state announced; each chart has a
  name made of its title and its insight; each legend is one tab stop
  with the arrow keys inside it; the Session page's view titles are
  headings and the footer's list titles are not; focus rings are two
  pixels of the accent.
- **The Session Explorer shows its first page at once**, from a small
  answer of the 20 newest sessions and the total count, and fetches the
  full list behind it; the controls wait for the full list.
- **Charts.** Bars start at zero; line labels no longer cross their
  lines; a ratio is an annotation, not a legend entry; the trends fill
  their cards and tick every month, the first and last included; the
  subagent histogram labels its bins; donut legends are one column on a
  phone; the BibTeX wraps.
- **The start module is written for one page again**, and the review's
  minor findings are fixed: the footer counts the weeks as the hero
  does, `aria-current`, one scrolling-row helper, one `[hidden]` rule,
  the tab row's error paths, stale comments and test names.

## Impact
- Specs: `explore-page` (Overview, trends, table, Insights, legends,
  readability, footer, the page before the data), `site-repository`
  (navigation), `week-selection` (which queries see every harness).
- Code: `site_data/answers.py`, a new query `explore/sessions_first_page.sql`,
  `js/explore/*`, `js/theme/colours.js`, `js/shared/*`, the figure
  modules' technical fields, `style.css`, the session page's markup;
  the tests. **No sentence a figure, the hero, the footer or the guide
  line shows is rewritten**, except that the two donut captions drop the
  words "human-driven" and the footer's week count is counted.
- Data: `make data` rewrites the answers (the Overview's with every
  harness, the new first-page answer); the Parquet files and the buckets
  are unchanged.
