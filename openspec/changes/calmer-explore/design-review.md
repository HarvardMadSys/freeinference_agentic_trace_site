# Design review

Every page was looked at in light and dark, at 1280 px and 360 px, with the default selection. The
pickers, the table's filters and the type scale are already decided and are not reviewed here.

## The five changes that matter most

1. Captions: every figure, trend and distribution card gets one short line; the rest of today's
   paragraph, the row count, hidden-bin notes and every "where the paper…" clause go behind one
   **Definition** control at the same place on every card.
2. Say "the paper's harnesses · 16 weeks" once, under the page lede, and remove it from all 31 card
   footers.
3. Chart text: at 14 px or more, at most six ticks per axis. Drop minor log gridlines and ticks, the
   ↑ and → arrows, y-axis titles that repeat the card title, and the "Week" axis title. Use one tick
   format per quantity: durations as 1 s, 1 min, 1 h, 1 d (never "100m" for 100 ms), percentages
   without decimals, hit ratios always as percentages.
4. Distribution cards: remove the p50/p75/p90/p95 labels drawn above the lines, which collide on
   four cards. Make the legend the summary, on one line: "p50 129k · p75 … · p90 413k · p95 … · max
   1.8M".
5. Fix the parts that look broken:
   - At 1280 px the sessions table is wider than its card, and the column it is sorted by is
     off-screen.
   - At 360 px the Context and Timeline charts on the Session page are cut off at the right.
   - The top point of Dead over active cache by policy is clipped.
   - The four lines of Simulated hit ratio by TTL sit on top of one another.

## Rules used throughout

- **The control.** A text button reading "Definition", in muted type and placed where the row-count
  line sits now (bottom left of the card). Opened, it shows the full definition, then a line
  "1,125,604 rows", then any "n bins hidden (fewer than 50 rows each)" note, then "Differs from the
  paper: …" if the card has such a clause. Same control, same position, on trend, distribution and
  figure cards and on the Session page's Context and Timeline cards.
- **Caption.** One sentence, at most about 90 characters, so it fits on one line at desktop width,
  no parentheses, no semicolons, no "Log scale." (the axis shows it), no "CDF of" (the axis titled
  "Share of …" shows it).
- **Card anatomy, in this order on every card:** title, caption, legend, chart, control. Legends
  always sit above the chart, left-aligned, never below (today the Session page's Context and
  Timeline cards put them below).
- **Chart height.** One height per kind: 240 px for every trend, distribution and figure chart
  (distribution charts are 220 today), and the two tool box-plot charts keep their taller height,
  equal to each other. With one-line captions, the plot areas of two cards in a row then start at
  the same height; today they do not, because captions differ by up to four lines.
- **Legend swatches match the mark.** A short line for line charts (CDFs, TTL curves, idle-gap
  lines), a square for bars and areas. Today every legend uses squares.
- **Axis titles.** No arrows. Sentence case, short: "Share of sessions", "Seconds", "Cache TTL".
  Drop a y title when the card title already names the quantity.
- **Number formats.** Counts: 1k, 10k, 1M, lower-case k everywhere (today "1,000" and "1k" both
  appear on log axes, and "1000 10000" on Gap before a request by cause). Percentages: "0%, 20%, …
  100%", never "100.0%" or "0.0%". Durations: "1 s, 10 s, 1 min, 10 min, 1 h, 1 d". Never use "m"
  for milliseconds, because "1m" means a minute on the idle-gap and TTL axes.
- **Category names** are written the same everywhere: "Cached input", "Uncached input", "Output"
  (today also "Cached", "Uncached"); "User" rather than "Human"; the leading "*" on tool categories
  (for example "*Search") is either explained once in the Definition of the cards that show it or
  removed.

## Explore page

### Page title and lede

- Keep "Explore the trace".
- The lede still says "pick weeks". Replace it with: "Sixteen weeks of coding and assistant agents:
  weekly trends, distributions, the paper's figures, and every session." Under it, in muted type,
  one line: "All figures: the paper's harnesses, every week." This line replaces the footer on every
  card.

### Header (all pages)

- The nav has both "Sessions" (the session figures) and "Sessions table". Rename the anchors after
  their section headings below: "Sessions", "Tools", "Prefix caching", "Session list" (see the
  sessions table). At 360 px the nav wraps to two rows under the brand; fine, but give the two rows
  the same left edge as the page text (today the active pill's padding pushes "Explore" in).
- On the Session page no nav item is marked active; mark "Explore", since the page is reached from
  it.

### Weekly trends card

- Today one card holds three charts in a two-column grid, so "Input tokens per week" sits alone with
  an empty right half. Lay the three out as three equal columns at desktop width, one column under
  900 px.
- This is the only place where several charts share one card. Either give each trend its own card in
  the same style as the figure cards, or keep one card and give it a heading "Weekly trends". Prefer
  the first.
- Captions:
  - Sessions per week: "Top-level sessions each week, by harness."
  - Requests per week: "LLM requests of top-level sessions each week, by model."
  - Input tokens per week: "Input tokens each week: cached, uncached or not reported."
- Remove "Faint bars are weeks outside the selection; click a bar to select its week alone": with
  the figures static it no longer holds.
- Remove the y titles "↑ Sessions", "↑ Requests", "↑ Input tokens" (the card titles say it) and the
  x title "Week".
- x ticks read "05-17 06-07 07-05 08-02" while the rest of the site says "May 17". Use "May 17, Jun
  7, Jul 5, Aug 2". Token split by week, which uses "05-17 … 08-30" with different weeks ticked,
  should use the same ticks.
- Sessions per week and Requests per week have legends of two and three rows, so their x axes sit 26
  px apart. With three columns, give each legend at most eight entries and let both wrap to the same
  number of rows, or fix the legend block to three rows' height in all three trend charts.

### Headline numbers strip

- Eight tiles in a six-column grid leave two tiles alone on a second row. Use four columns at
  desktop (two rows of four) and two at 360 px (four rows).
- The sub-lines run to four and six lines ("Cached tokens over the input of the requests whose
  provider reports cache reads"), so tile heights differ. Make each sub-line one short phrase and
  move the definition into a tooltip (title attribute):
  - Sessions: "top-level"
  - Accounts: "distinct users"
  - Requests: "of top-level sessions"
  - Input tokens: "prompt tokens"
  - Output tokens: "completion tokens"
  - Tool calls: "emitted by responses"
  - Subagents: "spawned, at any depth"
  - Cached share: "of reported input"

### Model mix

- Eighteen pills, the last seven at 0.1 % or 0.0 %, take three lines at desktop and nine at 360 px.
  Show the models above 1 % and end with one muted pill "9 others · 3.7%" (with the real count and
  share); the full list goes in that pill's tooltip.
- The pill's coloured mark is a left half-ring that reads like an opening parenthesis. Use a small
  filled dot before the name, as the legends do.
- "Model mix, share of requests" is set in body text with no card and no heading. Give it the same
  left edge and spacing as the headline tiles above (today it sits closer to the cards below than to
  the tiles above).

### Distribution cards (eight cards, no section heading)

These cards come between the headline numbers and "Sessions figures" with no heading of their own.
Add the heading "Distributions" in the same style as the three figure sections, so that the page
reads as five sections.

Common to all eight:

- Remove the p50/p75/p90/p95 text above the dashed lines. It collides on Input tokens per request,
  Uncached input tokens per request, Cached fraction per request (p50 and p95 overprint) and
  Subagents per session (p95 runs into the axis title).
- Merge the legend and the "n = … · p50 … · p90 … · max …" line into one legend line with values:
  "‐‐ p50 129k  ‐‐ p75 210k  ‐‐ p90 413k  ‐‐ p95 590k  · max 1.8M" (values from the data). The "n =
  …" part moves behind the Definition control.
- Drop "Log scale." from captions, the arrows on the y titles, and minor tick marks on log axes.
- Captions (the "A value of 0 is counted in n …" sentence goes behind the control on each card that
  has it):
  - Input tokens per request: "Prompt tokens of each top-level request."
  - Uncached input tokens per request: "Input minus cached tokens, where the provider reports cache
    reads."
  - Output tokens per request: "Completion tokens of each top-level request."
  - Requests per session: "LLM requests of each top-level session, subagents excluded."
  - Turns per session: "User turns of each top-level session."
  - Subagents per session: "Subagent sessions each top-level session spawned, at any depth."
  - Session duration: "First arrival to last completion of each top-level session."
  - Cached fraction per request: "Cached over input tokens, where the provider reports cache reads."
- Per card:
  - Turns per session: x ticks "2 … 10 20 … 100 200" crowd at the right; use 1, 10, 100.
  - Subagents per session: ticks "1 2 3 10 20 30" are uneven; use 1, 10, 30 or 1, 3, 10, 30.
  - Session duration: ticks "10s, 1m 40s, 16m 40s, 2h 46m, 27h 46m" are powers of ten seconds. Use
    10 s, 1 min, 10 min, 1 h, 1 d.
  - Cached fraction per request: ticks "0.0% … 100.0%" become "0% … 100%". Almost every request sits
    in the last bin, so the chart is one bar; keep it, but with the labels removed the overprint
    goes away.

## Sessions figures

- Section heading "Sessions figures" becomes "Sessions"; likewise "Tools" and "Prefix caching". The
  word "figures" is on every heading and adds nothing.
Cards, in page order (footers go, as everywhere):

- **Requests and steps per session.** Caption: "Requests, user steps and tool steps of each
  top-level session." Behind the control: the CDF wording and "a session with no tool step is drawn
  at one". y title "Share of rows" becomes "Share of sessions"; x title "Per session →" becomes
  "Count". This is the only CDF with dense vertical minor gridlines; remove them so it matches Turn
  and session duration beside it.
- **Turn and session duration.** Caption: "Duration of each turn and of each top-level session." x
  ticks "1, 100, 10k" seconds become "1 s, 1 min, 1 h, 1 d" with no x title. y title "Share of rows"
  becomes "Share".
- **Tokens per request.** Caption: "Input, uncached input and output tokens of each request."
  Behind: the cache-report and "more than one, as in the paper" clauses. x title "Tokens per request
  →" goes (the card title says it).
- **Cost share by session.** Caption: "Each session's cost by token kind, sessions ranked by cached
  share." The prices and rank-bin wording go behind the control. x title "Sessions ranked by cached
  share (percentile) →" is cut off at 360 px; make it "Session percentile". y title "Share of cost"
  may stay.
- **Token split by week.** Caption: "Share of cached input, uncached input and output tokens, each
  week." "Where the paper weights them by price" goes behind. y ticks "100.0%" become "100%"; drop x
  title "Week"; legend reads "Cached input, Uncached input, Output" to match Cost share by session
  beside it, which already does.
- **Token growth with the context.** Caption: "Median cached, uncached and output tokens per
  request, by messages in the request." Remove the minor gridlines on both log axes; today they form
  a dense mesh unlike any other card. The y axis shows only 1k, 10k, 100k while the output line runs
  below 1k; add 100.
- **Context share by role.** Caption: "Share of the input held by each role, by input size." x title
  "Input tokens, from" becomes "Input tokens"; ticks "1k 4.1k 16.4k 65.5k 262.1k" become "1k 4k 16k
  64k 256k". y ticks "100.0%" become "100%". The two-line footer note on hidden bins goes behind the
  control.
- **Time to first token by model.** Caption: "Time to first token of each request, for the five
  busiest models." The trusted-TTFT rule and the paper comparison go behind. x ticks "100m" and
  "10m" mean milliseconds; write "0.1 s", "1 s", "10 s", "100 s". x title "Seconds to first token →"
  goes. The legend's fifth entry, glm-5.3-flash, sits alone on a second row. Make it fit on one row,
  or wrap Time to first token by model and Decode time by model identically.
- **Decode time by model.** Caption: "Latency minus time to first token, for the same five models."
  Same tick fix ("10m", "100m" become "0.01 s", "0.1 s"). Same legend order and wrapping as Time to
  first token by model.
- **Session time by part.** Caption: "Each session's time on the model, on tools and waiting for the
  user, sessions ranked by user share." Legend "Human" becomes "User". The red area fills half the
  chart and reads as an alarm, loudest in dark mode. Give User a calm hue, a light grey-blue or
  sand, and keep red for nothing on this page. x title becomes "Session percentile", as on Cost
  share by session.

## Tools figures

- **Tool latency by category.** Caption: "Tool call latency per category: box 25th to 75th
  percentile, whiskers 5th to 95th." Behind: "over calls that were their request's only call", and
  the paper marks the mean. Remove the vertical minor gridlines (a dozen thin rules between 1 and
  100). x title "Seconds after the request →" becomes "Seconds". Ticks show only 1, 10, 100; add 0.1
  and 1k if the data reaches them, or keep three, but match the number of ticks on Tool result size
  by category.
- **Tool result size by category.** Caption: "Result tokens per tool category: box 25th to 75th
  percentile, whiskers 5th to 95th." x title "Result tokens →" becomes "Tokens".
- Both: the "*" before eight category names is unexplained on the page. Explain it in the Definition
  control ("* a group of shell programs") or drop it. The category colours match the Session page's
  tool chips; keep them, but the two greens (Interpreter teal and File Ops dark green) are close in
  light mode and muddy in dark mode (see Dark mode).
- At 360 px both charts sit 40 px below their captions with an empty band where no legend is; remove
  the empty top margin so the plot follows the caption as on other cards.

## Prefix caching figures

- **Hit ratio by gap before the request.** Caption: "Hit ratio of each request, by how long it
  waited since the previous one." The six-bin and hidden-bin wording goes behind. x ticks "0.0 …
  1.0" become "0% … 100%", as on the y axes and on Hit ratio after an idle gap beside it. The blue
  ramp's lightest line (<1m) is near-invisible on white and the darkest (>1h) nearly disappears on
  the dark background; keep the ramp between about 35 % and 85 % lightness. Line swatches in the
  legend. Today this card has a 130 px empty band under its chart because its neighbour's caption is
  seven lines; one-line captions fix it.
- **Hit ratio after an idle gap.** Caption: "Median hit ratio by time since the user's previous
  request, one line per provider." The current caption is 446 characters, the longest on the page;
  all of it goes behind the control, as does "44 bins hidden". Legend order is "A, B, D, C, E, F,
  H"; sort it A to H. Provider B and Provider C are two close oranges, and E and H a close pink and
  salmon; give them distinct hues (see Dark mode). x title "Idle gap →" becomes "Idle gap".
- **Gap before a request by cause.** Caption: "Gap before each request, by what it waited for." x
  ticks "0.1 1 10 100 1000 10000" become durations "0.1 s, 1 s, 10 s, 1 min, 1 h" and x title "Gap
  before the request (s) →" goes. Line swatches.
- **Mean hit ratio by cause.** Caption: "Mean hit ratio of requests, by what the gap before them
  waited for." The axis-from-0.7 rule goes behind the control. Each bar carries its value ("0.97")
  and the axis repeats it; keep the values as "97%" and drop the x ticks and the "Mean hit ratio →"
  title. The bars are coloured by cause as in the card beside it; keep that, since the colours tie
  the two cards together.
- **Hit ratio after a context change.** Caption: "Hit ratio of requests that append to the context,
  and of those that rewrite it." x ticks become "0% … 100%". "As in the paper" and the switch
  exclusion go behind.
- **Simulated hit ratio by TTL.** Caption: "Simulated hit ratio by cache TTL, where the four eviction
  policies nearly coincide." The four lines sit on each other, so only the last-drawn (orange) shows
  while the legend lists four; saying so in the caption is the tidy fix. Draw TTL only last so the
  policy readers look for is the visible one. Thirteen TTL ticks at 14 px will not fit; label every
  other one (1 s, 30 s, 5 min, 15 min, 1 h, 6 h, ∞), as the 360 px layout already does, on all three TTL
  cards.
- **Retained over active cache.** Caption: "Reusable and dead token-seconds over active ones, per
  cache TTL." The TTL-only and paper clauses go behind. y title "Retained / active" may stay. The
  dashed rule at 1 is unexplained; keep it and say "dashed: equal to active" in the Definition.
- **Dead over active cache by policy.** Caption: "Dead token-seconds over active ones, per cache TTL
  and eviction policy." The topmost point (TTL only at ∞) is clipped by the top edge; extend the y
  domain to the next power of ten. The y ticks run to "0.001"; with one-line captions the two TTL
  cards in this row will align; check that their y axes start at the same height.

## Sessions table

- At 1280 px the table is 1,399 px wide inside a 952 px card. Duration, Input tokens, Cached share
  and Peak prompt scroll off to the right, and the table is sorted by Input tokens, so the visible
  order looks random and the sort arrow is hidden. Make it fit at desktop:
  - Drop the Week column (the Started date gives it, and the month filter covers it).
  - Write Started as "Aug 31, 02:44".
  - Use compact numbers in token columns ("11.1M", "114.9k", as the cells already do).
  - Narrow Session to its eight characters. If it still overflows, Subagents (0 in almost every row)
    can move to the Session page. At 360 px a horizontal scroll is fine; make the Session column
    sticky so the link stays in view.
- Table cells carry wide letter-spacing ("2 0 2 6 - 0 8 - 3 0", "deepseek-v4-flash" looks spaced
  out). Remove the tracking from cells and keep tabular figures.
- Heading "Sessions table" is set inside its card, while the figure sections put their headings
  outside. Put it outside and name it "Session list", so it is not confused with "Sessions".
- The "10,967 of 10,967 sessions" count sits tight under the filters and above the header row; give
  it the same spacing as a caption.
- The pager (Prev, "Page 1 of 220", Next) sits flush on the last row and its label is smaller than
  the buttons. Add a row gap above it, right-align it, and set the label at the same size as the
  buttons.

## Footer (all pages)

- "From Requests to Sessions: a large-scale characterization …" is lower-case here and title case on
  the About page. Use the paper's title case and make it the paper link, then "Dataset · Pipeline".
  At 360 px it wraps to two centred lines; fine.
- In dark mode the footer text is the dimmest text on the page; raise it to the muted colour used
  for captions.

## Session page

### Title block

- "Session ec856dfc" and the full id beneath it in monospace are fine. Set the id in the muted
  colour and at caption size, so it reads as secondary.

### Facts strip

- Eleven tiles in a six-column grid leave a gap of one tile on the second row, and at 360 px Output
  tokens sits alone. Use four columns at desktop (three rows, the last holding three tiles, aligned
  left) or, simpler and calmer, a plain key–value list without boxes that wraps naturally.
- Tile heights differ because of the sub-lines. Drop the sub-lines that restate the label: "the
  agent program", "of the top-level session", "at every depth", "every agent" (twice). Keep the ones
  that add a number: Cached share "10.8M cached tokens".
- Started wraps its time to a second line in a large size. Show "2026-08-31" as the value and "02:44
  UTC" as the sub-line.
- Models reads "glm-5.3-flash · 4,073, deepseek-v4-flash · 954", mixing a middle dot and a comma and
  breaking across three lines. Put one model per line: "glm-5.3-flash 4,073" and "deepseek-v4-flash
  954", the counts muted.

### View tabs

- Tabs use an underline for the selected view; the header nav uses a filled pill; the Context view's
  "Cached and uncached / By role" uses red outlined pills with radio dots. Keep the tab underline,
  and render the Context choice as a small two-part segmented control in neutral colours without
  radio dots.

### Requests view

- Each row has the label, a monospace time, the token bar, then about 270 px of empty space before
  the tool chips. Start the chips right after the bar column, or right-align them consistently;
  today they float in the middle.
- The time "+00:07-00:12" uses a hyphen that reads as a minus, and a monospace face smaller than
  everything else. Write "0:07–0:12" (en dash) in the body face with tabular figures, at the same
  size as the step label, and in the same clock format as the Timeline axis.
- Tool chips: the coloured left half-ring looks like a parenthesis; use a 3 px left border or a dot,
  as for the model pills.
- The same tool name ("bash") appears in four colours, because the colour is the category. This is
  right, but the legend writes "∗Interpreter" with a different asterisk glyph from Explore's
  "*Interpreter"; use one.
- A 5,027-request session renders one page about 141,000 px tall. This is the one place the page
  looks unfinished at length. Show each turn's steps folded under the turn row, or paginate as the
  sessions table does; for short sessions nothing changes.

### Context view

- Caption: "Input tokens of each request over the session." Behind the control: the stacked-area and
  per-agent wording, the dotted turn rules, the mutation and switch dots, the tokenizer note and
  "Click a point to open its request" (or keep that last as a muted hint after the caption).
- The legend sits under the chart, unlike every Explore card; move it above. "Input per agent: main,
  mutation" mixes an agent with a marker kind; split it into "Agents: main" and "Markers: mutation,
  switch, turn start".
- At 360 px the chart is wider than the card and is cut at the right (the axis ends at +30:00 of a 1
  h 18 min session, the axis title is cut to "↑"). It must be drawn at the card's width.
- x ticks "+00:00 … +1:00:00" mix mm:ss and h:mm:ss. Use "0:00, 0:10 … 1:10" and the title "Time
  since first request (h:mm)".

### Timeline view

- Caption: "Where each agent's time went: model, tool calls and waits." The rest goes behind the
  control, and so does the footer note "A tool call's start is taken as its request's end", which
  repeats the caption.
- The chart is one 20 px strip inside a card whose legend (three rows) is taller than the chart,
  with an empty band below the legend. Give each agent row about 32 px, put the legend above, and
  remove the empty band.
- Same clipping at 360 px as the Context view, and the same tick format fix.
- "Time to first token" and "rest of the request" are two near-identical dark greys; make the
  second clearly lighter.

## About page

- Length: about 7,300 px at desktop and 13,600 px at 360 px. Most of it is the Definitions list,
  which is right; but two passages repeat:
  - "Where a query restates one in SQL … a mirror test … a parity test …" appears in the Definitions
    intro and again in How the data were built. Keep it once, in How the data were built.
  - "Every definition comes from the pipeline" appears in both places too.
- "What the site shows" still describes "weeks and harnesses you pick", and "Narrowing the
  selection…" and "In the browser, the default selection is drawn from those answers. Any other
  selection is computed by DuckDB-WASM…" describe the pickers and streaming, which this change
  removes. Rewrite to: the figures are computed once when the site is built; the sessions table
  filters in the browser; the Session page reads one week.
- Group headings ("Tokens and caching", "Time", …) look the same size as the bold terms under
  them; make them one step below the card heading, with more space above.
- Definition bodies are in the muted colour; across this length that is tiring to read. Use the body
  colour, keep the terms bold.
- Text runs about 700 px wide inside a 990 px card, leaving a 290 px empty band on the right of
  every card. Either narrow the About cards to the text measure or drop the cards on this page and
  let the text sit on the page background, with the four headings in the page's section-heading
  style.
- The list "Where the site draws more simply than the paper" is good and should stay, since the
  per-card differences now sit behind the control; make its intro say "Each figure's Definition says
  where it differs".

## Dark mode

- Muddy colour: the pure dark green used for codex, glm-5.3-flash, *File Ops and Provider F is
  low-contrast on the navy background and close to the teal beside it. Replace it with a lighter,
  distinct hue (a yellow-green or olive) in both schemes.
- The row-count and footer greys are close to 4:1 on the navy; raise them to the caption colour.
- Also in dark mode: the User area of Session time by part is the brightest block on the page, the
  darkest line (>1h) of Hit ratio by gap before the request nearly vanishes, and Providers B/C and
  E/H are harder to tell apart than in light. The changes proposed above cover all three.
