# Design review

**Verdict: not yet clear and tidy.** The top of the page now says what this is, and the look belongs to Open Data's family. What still stands in the way: two session counts that disagree, colours that change meaning from card to card, a muddy olive in the light palette, sections without Open Data's eyebrow-and-heading frame, and four charts that cannot be read as drawn.

## The five changes that matter most

1. **One session count everywhere.** The stats strip says 10,967 sessions, the session list says "12,002 of 12,002 sessions", and the nav's "Sessions" link lands on the Session list, not on the figure section called Sessions. Label the stat "human-driven sessions". Make the list's count line "12,002 sessions, 1,035 of them benchmark". Rename the nav link "Session list".
2. **One colour per meaning.** "Other" is always grey: today it is orange on the three tool-category cards and on the Session page, which also shows a second, grey "Other categories". Tool categories take their tool group's colour from Tool mix along a turn. The Session page's Where the time went uses the landing page's four parts: prefill blue, decode orange, tools green, user idle red.
3. **Fix the light amber slot.** It is #886c11 today and reads olive-brown: minimax-m3, Input, Tool results, *Search, Ask-User Tool and Storage all look muddy, and the dark version (#dfb424, gold) looks like a different hue. Use about #a87a00 (3.9:1 on white), or move the hue towards 75°. Deepen the light red #f25767, which reads coral, to about #e0394a (4.3:1) so that it reads as the paper's red. Rerun the contrast and colour-blindness test afterwards.
4. **Open Data's section frame, so the chart order reads as a story.** Give Overview, Figures and Session list each an eyebrow and a heading, as Open Data does. Number the six topics "01 Sessions" through "06 Human-driven against benchmark" in the monospace eyebrow style. Set the hero title in two lines at 1280 px (it takes three today).
5. **Four charts that cannot be read as drawn.**
   - Mean hit ratio by cause: the bars start at 70% with no axis, so 84% looks half of 97%. Start the bars at 0%.
   - Cached fraction per request: one visible bar, and four percentile lines on top of one another. Use a log y axis and the one-line summary "median 99.6% · p95 100%".
   - Subagents per session: the p50, p75 and p90 lines sit at 0, off the log axis.
   - Several x axes have no title while their ticks carry no unit (listed under Charts).

## Rules used throughout

- **A legend names what is drawn.** No legend entry without a visible mark: Output on API cost by TTL is invisible. No mark without a legend entry: the light-green bands on Tool latency by batch width are unexplained.
- **Sentence case for every series name**, as "Cached input" already is: "Tool wait", "Ask-user tool", "User idle", "Main agent", "Subagents", "Turn start", "Time to first token". Today "Tool Gap", "User Idle" and "Ask-User Tool" sit beside "User idle", and the Session page uses lower case ("main", "the user", "tools").
- **A y-axis title says what is counted**: "Share of requests", "Share of sessions", never a bare "Share".
- **An x-axis title appears whenever the ticks carry no unit**: "Tokens", "Subagents", "Cache TTL".
- **One number format per quantity on every surface**: one decimal kept with trailing zeros ("63.0 min", "94.0%", "2.0B"), seconds only below one minute ("61 s" becomes "1.0 min"), and dates as "Aug 1, 16:11" (the facts card writes "2026-08-01 16:11 UTC").
- **Crimson for the brand, links, the active tab and the primary button only.** No series uses it. In dark mode the accent (#ee6a7c) and the red series (#fb6874) are nearly one colour, so the hero's "request by request." matches the Benchmark line. Move the dark accent towards crimson-pink, about #f07a9a, or keep the red series clearly orange-red.

## Landing page

### Header

- At 1280 px it fits on one row and matches Open Data. Keep it.
- "Sessions" goes to the Session list while the first figure section is also called Sessions. Rename the link "Session list" (see change 1).
- At 360 px the sticky header takes three rows (132 px, 18% of the screen), and a stray divider hangs after "CITE". At phone width, keep the brand and the four in-page links on one scrolling row. Drop Dataset, Paper, Code and Open Data there: the hero buttons and the footer carry them.

### Hero

- The eyebrow, the crimson phrase, the buttons and the soft glow are right. It is the same family as Open Data without copying it.
- The title runs three lines at 1280 px ("Sixteen weeks / of coding agents, / request by request."), and the design asks for two. Make the copy column 7fr against 5fr for the stats card, and set the title at about 3.1rem so that "Sixteen weeks of coding agents," fits one line. If it still breaks, use the text "Coding agents, / request by request." and let the stats strip carry "16 weeks".
- The lede is good. Keep it.
- The four buttons: the URLs are distinct (Hugging Face, the paper PDF, GitHub), but the labels repeat the header. At 360 px they stack into three ragged rows. Shorten "Hugging Face dataset" to "Dataset" so that at 360 px they sit two by two.

### Stats strip

- The six numbers in a 3×2 grid read at a glance. Keep them.
- The stats card has no title, while Open Data's card has "Dataset catalog 05". It does not need one, but then the inner bordered grid inside the bordered card is a double frame. Drop the inner border and keep only the hairlines between cells.
- Replace "May 17 to September 5, 2026; the cache simulation covers all 16 weeks." with "May 17 – September 5, 2026 · benchmark replay not counted". Simulation coverage is a caching detail and belongs in the definitions of Prefill against storage and the two TTL cost cards.
- Label 10,967 "human-driven sessions" and 13 "harnesses" (see change 1).

### Overview

- Today the section has no heading, although the nav names it. Add the eyebrow "OVERVIEW" and the heading "The trace at a glance".
- **Donuts.** The size is right. Shares appear only in a native tooltip that takes a second to show, so the legend tells nothing.
  - Write each legend row as "deepseek-v4-flash 44%".
  - Tighten the legend rows from about 33 px to about 26 px, so the model legend's nine rows end level with the donut.
  - At 360 px, flow the legend in two columns under the donut instead of nine full-width rows.
- **Trend cards.**
  - Sessions per week names three harnesses and Requests per week four models, while the donuts directly above name seven and eight. Name the same set in both, with the same colours, so that the donut legend is also the trend legend.
  - There is 60 to 85 px of empty space between each trend legend and its chart. Let the chart start under the legend.
  - Shorten "LLM requests of top-level sessions each week, by model." to "Requests each week, by model." so that all three captions take one line.
  - "Not reported" on Input tokens per week is a grey hairline at the top of the bars. Keep it, but order the legend the way the stack draws, from top to bottom.

### Section order and headings

- The order Overview → Sessions → Tokens and cost → Latency → Tools → Prefix caching → Human-driven against benchmark → Session list → Cite → Team is a sensible story. Keep it.
- The six topics today are plain serif headings with no eyebrow, and "Figures" has no heading of its own. Add the eyebrow "FIGURES" and the heading "The paper's figures", then number the topics as in change 4. This is what makes the order visible.
- Give the Session list the same frame: eyebrow "SESSIONS", heading "Every session".

### Charts, section by section

**Sessions**
- Requests and steps per session: rename the x title "Count" to "Requests or steps". The Requests and Tool steps lines overlap almost completely; that is the data, so leave it.
- Turn and session duration: change the y title "Share" to "Share of turns or sessions".
- Subagents per session: the four dashed percentile lines sit at 0, which the log axis cannot show, so they pile up at its left edge.
  - Remove the lines.
  - Make the legend the summary "median 0 · p95 1 · max 40".
  - Caption: "Subagents per session; most spawn none, those that do are drawn."
  - Add the x title "Subagents".
- User prompt size: the median labels "42" and "1.4k" are written on the chart and again in the legend ("median 42 vs 1.4k · 34.4×"). Keep the chart labels and shorten the legend's part to "benchmark 34× longer". Add the x title "Tokens".

**Tokens and cost**
- Tokens per request: change the y title to "Share of requests" and add the x title "Tokens". "Input" in olive is the colour of change 3.
- Token growth with the context: the caption wraps. Use "Median tokens per request, by messages in the request."
- Context share by role: Assistant is green, the colour that means Cached input on its neighbours, System is blue (Output) and User orange (Uncached input); Tool results is olive. Give the five roles the slots no token part uses: System violet, User teal, Assistant magenta, Tool results amber, Tool definitions grey.
- Cached fraction per request: change 5. Rename it "Cached share per request", so that one quantity has one name across the card, the session list and the facts card. Inside Prefix caching, "hit ratio" stays.
- Cost share by session: fine. The x ticks could read "0%…100%" to match the y axis.

**Latency**
- Time to first token and Decode time: change the y titles to "Share of requests". The five-model legend wraps to a second row; that is fine.
- Session time by part: it reads as the paper's Figure 4c (blue, orange, green, red). With the red from change 3 it will read even closer.
- Speed-up if twice as fast: clear. The bars start 40 px lower than the plot on the left because the card reserves a legend row it does not use. Remove the empty legend row on every card without a legend: this one, Calls per request and Mean hit ratio.

**Tools**
- Tool latency by category and Tool result size by category:
  - "Other" is orange and second in the list, and Edit is magenta while Tool mix along a turn draws Write/Edit in violet. Colour each category by its group in Tool mix (Read blue, Search amber, Write and Edit violet, Interpreter green as Execute, Build/Test teal, Git/VCS red, Browser and Network magenta), everything else, Other included, grey.
  - Put Other last.
  - The asterisk ("*Search") is explained only in the definition. Either drop it or add the legend note "* shell command".
- Calls per request by category: same colours. The card is about 160 px taller than Tool latency by batch width beside it, so the batch-width card has a blank band under its chart. Let the batch-width chart grow to fill the row.
- Tool latency by batch width:
  - Add the bands to the legend: "Batched calls, p10–p90" and "p25–p75".
  - Rename "One call per request" to "Same calls one by one". The caption says "against serial calls"; use the same words in both places.
  - Tick every width, 1 to 8+.
- Tool mix along a turn: at 360 px the panel titles "Human-driven Benchmark" run together. Put each panel's title at its own left edge. The x ticks lack 0% and 100%.

**Prefix caching**
- Hit ratio by gap before the request: six blues, of which the middle four are hard to tell apart. Keep the scale, and label the two ends on the lines ("Under 1 min", "Over 1 h"). Change the y title to "Share of requests".
- Hit ratio after an idle gap: the legend runs from Provider A to F, then H, with no G. A visitor reads that as a mistake. If the letters are fixed identities in the release, say so in the definition; otherwise letter them A to G.
- Gap before a request by cause and Mean hit ratio by cause: use sentence case, with the names of Session time by part. "Tool Gap" becomes "Tool wait", "User Idle" becomes "User idle", "Ask-User Tool" becomes "Ask-user tool". Change the y title to "Share of gaps". Mean hit ratio: see change 5.
- Hit ratio after a context change: about 180 px of blank space under the chart, because Context mutations beside it is a long table. Let the chart grow to the row height.
- Context mutations by cause: this is the table that looks awkward.
  - Its two-decimal numbers ("96.00", "0.04") clash with every other percentage on the site.
  - Use one decimal with a % sign ("96.0%", "0.4%", and "<0.1%" below that).
  - Column heads: "Steps", "Sessions", "Prefill missed", in the card's sentence case.
  - Indent the cause rows under Mutation with a muted "of which" line instead of bold parent rows.
- Prefill against storage: the TTL labels collide with the red curve near "10 s" and "1 min". Put the benchmark's labels below its line, and give every point label a paper-coloured halo.
- API cost by TTL and Infrastructure cost by TTL:
  - Add the x title "Cache TTL".
  - Remove Output from the API cost legend, or say "Output (too thin to see)"; prefer removing it.
  - "Knee 0.65× at 30 min": the word "knee" is jargon. Use "0.65× at 30 min, near the lowest".
  - At 360 px both annotations run over the areas. Give them the halo, and anchor the Infrastructure annotation to the left of its point.
  - Infrastructure's caption wraps. Use "Serving cost at each TTL: recomputing misses against storing tokens."

**Human-driven against benchmark**
- The ratios flip direction without saying so: "3.1×" for turns means the benchmark is longer, "9.4×" for sessions means human-driven is longer. Write the direction: "benchmark 3.1× longer", "human-driven 9.4× longer", "human-driven 5.1× more".
- Turn duration mixes "60.6 s" and "3.1 min" in one comparison. Use "1.0 min vs 3.1 min".
- Input per request: add the x title "Input tokens".

### Definitions

- Opened, the definitions look right: text, then the row count, with one control at one place on every card.
- Their content is still the paper-comparison prose that the design moved to the repository's notes. Remove every "where the paper …" and "as in the paper" clause. Ten cards have one, for example Token split by week, Time to first token, Decode time, Hit ratio after an idle gap and the two tool box-plot cards.
- Replace "CDF over/of" with plain words ("Share of requests at or below each …"). The axis already says "Share".

### Session list

- The controls row reads well. The monospace uppercase labels match Open Data's eyebrows.
- The Harness drop-down is 340 px wide because of "eval:swe-bench (benchmark replay)". Name the choice "swe-bench (benchmark)" and give the five controls equal widths, with Search the widest.
- **The benchmark mark** is that long string in the cell, with no tooltip; the design asked for one. Show "swe-bench" followed by the monospace chip "BENCHMARK", styled like Open Data's "RELEASED" chip, with the tooltip "A replay of SWE-bench tasks, not human-driven."
- **The month filter shows other months' dates.** "July 2026" lists sessions from "Aug 1, 23:10", because a month means the weeks whose Sunday falls in it. Either filter by the session's start date or label the choice "Weeks of July 2026". Prefer filtering by start date: the column beside it shows dates.
- **The table scrolls inside its own box,** about 520 px high, inside a page that also scrolls, and it pages 50 rows at a time. Show 20 rows per page with no inner scroll, so that each page is one card and Prev/Next sit under the last row. The sticky header row is then not needed.
- Number formats: "63 min" sits beside "63.9 min", "94%" beside "97.8%", "2B" beside "474.2M", and "61 s" beside "1.9 min". Apply the format rule.
- At 360 px only Session, Started and Harness show, "opencode" is cut at the card edge, and nothing says the table scrolls sideways. At phone width show Session, Started, Harness and Requests, and fade the right edge when more columns lie beyond. Put the controls two to a row (Month and Harness, Model and Min requests, then Search).

### Cite

- It is good and matches Open Data. The copy button turns to "Copied" with a crimson outline in both schemes.
- The intro sentence is short enough. Link the paper's title in it, as Open Data does ("please cite *From Requests to Sessions*").

### Team

- At 1280 px the five names wrap to two rows, and the second row starts 22 px to the right of the first. Shorten the affiliations so the names fit one row as in Open Data ("UChicago & Harvard", "Toronto", "Harvard", "UChicago", "Harvard"), or lay them out on a grid so both rows share the left edge.
- "Harvard MadSys and collaborators." floats at the far right, below the heading's baseline. Align it to the heading's baseline, as Open Data does.
- The About paragraph's second sentence is awkward. Use "This site shows the paper's figures on the trace and opens any session in it."
- Drop the four arrow links under it: the header, the hero and the footer already carry them, and this is their fourth appearance.
- Open Data gives About its own section on the crimson-wash band. If About stays inside Team, give the Team section that band, so the page's end has one tinted rest between grey sections.

### Footer

- It matches Open Data.
- "Code" and "GitHub" both appear under Elsewhere, so the visitor cannot tell them apart. Rename "Code" to "Code (this trace)" and "GitHub" to "MadSys on GitHub", or drop GitHub.
- The blurb repeats the Team line word for word. Use "A trace of agent sessions served by FreeInference."

## Session page

### Title row and facts card

- It reads as one card with fields. Muted labels over bold values is the right form.
- It is too tall, 490 px against a title block of about 110 px, which leaves a blank area under the title. At desktop width use three columns, so it holds four rows instead of six.
- Order the eleven fields so that the ones with a "+ n in subagents" line pair up (Turns with Requests, Tool calls with Subagents). Today Output tokens sits alone on the last row.
- "Started 2026-08-01 16:11 UTC": write "Aug 1, 2026, 16:11 UTC", as the list does.
- "2B" input tokens with "2B cached" under 97.4% looks wrong. Use three significant figures ("2.04B", "1.98B cached").
- "Models" lists counts in muted small type ("517"). Add "requests" after the first one.
- At 360 px "deepseek-v4-flash" breaks at its hyphen and the date wraps to two lines. Use one column at phone width, and never break inside a model name.

### View tabs

- Clear. The active tab's crimson underline matches the header. Keep them.

### Requests view

- The three token parts read well in the legend. The Output part is a one-pixel sliver on every bar. That is honest, so keep it, and say so in the definition.
- The Tool calls legend shows "Other" in orange beside "Other categories" in grey. Merge them into one grey "Other" (change 2).
- "2 overlap brackets are not drawn: more than 6 cross here." is engineering text in the legend. Move it into the definition, or remove it.
- About 230 px of empty column lies between the bars and the tool chips. Narrow it, or let the bars use it.
- Times read "0:00–0:03" with no unit, while the other views say "(h:mm)". Add "(h:mm)" to the column, or write "0:00–0:03 min" on the first row.
- The largest session draws 5,040 rows, a page 179,000 px tall. Open every turn folded when a session has more than 50 turns. Expand all is one click away.

### Context view

- The chart is clear, and narrowing the range redraws it with sensible ticks.
- The legend's three labelled rows (Top-level input, Agents, Markers) are heavy, and their items are in lower case. Make it one row: "Cached input · Uncached input · Main agent · Subagents · Turn start".
- The dense turn-start markers early in a session draw as a hatched block. Draw a marker only where it is at least 3 px from the previous one.

### Timeline view

- Its parts do not match the landing page. Map "time to first token" to Prefill (blue), "rest of the request" to Decode (orange), "tools" to Tools (green), and "the user" with "an ask-user tool" to User idle (red, as in Session time by part's definition). Subagent waits go to violet, the slot no part uses. Waits keep a pale tint of their part's colour.
- In dark mode the wait colours are dark and muddy (brown-red, dull green, navy). Use the same pale tints at about 45% opacity over the dark card, so they stay lighter than the card.
- The caption repeats the title ("Where the time went" / "Where each agent's time went…"). Use "Each agent's requests, tool calls and waits, along the session."
- At 360 px the labels "sub 5793bd0b" take half the width and the plot is 145 px wide. At phone width label the rows "sub 1" to "sub 9", with the id in the row's tooltip.

### Range slider

- The handles and the keyboard behaviour work, and the focused handle shows a crimson ring.
- The selected range is a dark grey bar (light) or a pale bar (dark) on a plain track, not the "small brush strip" the design describes. Fill the selection with the accent wash and give it a crimson 2 px edge. Leave the track the paper colour.
- The readout reads "Time range 52:42–1:45:25 of 2:55:43": minutes and seconds beside hours, while the axis says h:mm. Write "0:52–1:45 of 2:56 (h:mm)". For sessions over a day, write "29.7 h–59.4 h of 98.9 h", not "29:40:46".
- At 360 px the readout wraps to two lines. With the shorter text it fits on one.

## Phone width (360 px), together

- The header takes three rows (see Header). The hero buttons stack in three ragged rows (see Hero).
- The donut legends take nine full rows each. The session list's controls take 430 px before the first row.
- The timeline's labels take half the width.
- Chart annotations on the TTL cost cards run over the areas.
- Nothing overflows the page: the document stays 360 px wide.

## Inconsistent between two cards

- Model mix names 8 models while Requests per week names 4; Harness mix names 7 harnesses while Sessions per week names 3.
- Session time by part's "User idle" sits beside Gap before a request by cause's "User Idle" and the timeline's "the user".
- Cached input is green on four cards, and Assistant is green on Context share by role.
- Tool mix along a turn draws Write/Edit in violet; the box plots draw Edit in magenta and Write in violet.
- "Share of sessions" on Requests and steps sits beside "Share" on Turn and session duration.
- Requests per week's caption takes two lines; its two neighbours take one.
- The facts card writes "2026-08-01 16:11 UTC"; the session list writes "Aug 1, 16:11".

## Remaining, in order of weight

1. Stats strip: label "human-driven sessions"; the list's count line becomes "12,002 sessions, 1,035 of them benchmark"; the nav link becomes "Session list".
2. Make "Other" grey everywhere. Colour the tool categories by their Tool mix group, Other last. Merge "Other" and "Other categories" on the Session page.
3. Timeline view: prefill blue, decode orange, tools green, user idle red, subagent waits violet, with pale tints that stay pale in dark mode.
4. Light amber #886c11 to about #a87a00. Light red #f25767 to about #e0394a. Rerun the palette test.
5. Context share by role: use slots no token part uses for the five roles.
6. Eyebrow and heading for Overview ("The trace at a glance"), Figures ("The paper's figures") and Session list ("Every session"). Number the six topics 01 to 06.
7. Hero title in two lines at 1280 px: copy column 7fr, title about 3.1rem.
8. Mean hit ratio by cause: bars from 0%.
9. Cached share per request (renamed): log y axis, legend "median 99.6% · p95 100%", no percentile lines.
10. Subagents per session: no percentile lines, legend "median 0 · p95 1 · max 40", the new caption, x title "Subagents".
11. Session list: start-date month filter, "swe-bench" plus a BENCHMARK chip with a tooltip, 20 rows per page with no inner scroll, equal control widths.
12. One number format: one decimal kept, seconds only under a minute, "Aug 1, 16:11" dates, three significant figures for billions.
13. Context mutations by cause: one decimal with "%", the heads "Steps", "Sessions", "Prefill missed", the cause rows indented.
14. Axis titles: "Share of requests" or "Share of gaps" for every bare "Share"; add "Tokens", "Input tokens" and "Cache TTL" where the ticks have no unit.
15. Comparison legends: write the ratio's direction ("benchmark 3.1× longer"), use one unit per pair, and drop the medians that duplicate the chart labels.
16. Donut legends with shares; tighter rows; trend cards name the same models and harnesses as the donuts; no gap under the trend legends.
17. Facts card: three columns at desktop, one at phone width, paired fields, no hyphen breaks in model names.
18. Range slider: the selection filled with the accent wash; the readout "0:52–1:45 of 2:56 (h:mm)".
19. Remove the "where the paper …" clauses from the definitions, remove the empty legend row on cards without a legend, and let the shorter card in a row grow its chart.
20. Phone header: brand and four in-page links on one row. Team affiliations shortened to fit one row. Footer "Code" and "GitHub" told apart, and its blurb no longer repeating Team.
