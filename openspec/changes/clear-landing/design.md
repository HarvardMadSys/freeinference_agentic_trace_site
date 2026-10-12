# Design

Every module follows the repository's rules (`site-repository`).

## The landing page

One page, `index.html`, in this order:

1. **Header**, sticky, blurred paper, a hairline below: the brand
   "FreeInference agentic trace", the affiliation "Harvard SEAS · MadSys
   Lab" linking to the lab, then the in-page links Overview, Figures,
   Sessions, Cite, and the external links Dataset, Paper, Code, Open Data.
   Sections carry a scroll margin so an anchor lands below the header.
2. **Hero**: the eyebrow "FreeInference agentic trace", a two-line title
   with a crimson phrase ("Sixteen weeks of coding agents, request by
   request."), one lede sentence, and four buttons: "See the figures"
   (primary, to the first section), "Hugging Face dataset", "Paper",
   "Code". The right column holds the stats strip.
3. **Stats strip**: six numbers computed from the answers already
   shipped (`explore/trace_summary` or the headline queries): weeks,
   sessions, requests, input tokens, tool calls, harnesses; a seventh line
   names the span of dates and the simulation's coverage. This replaces
   the headline tiles and the population line.
4. **Overview**: two cards side by side, the model mix as a donut (share
   of requests per model, the eight most frequent named and the rest
   "Other", drawn from the `explore/model_mix` answer with the models'
   colour order) and the harness mix as a donut of sessions (from
   `explore/sessions_per_week_by_harness` summed); then the three weekly
   trend cards.
5. **Figures**, six sections with a heading and no intro:
   - Sessions: requests and steps per session, turn and session
     duration, subagents per session (the histogram that had no twin),
     user prompt size.
   - Tokens and cost: tokens per request, token split by week, token
     growth, context share by role, cached fraction per request (the
     other orphan histogram), cost share by session.
   - Latency: TTFT by model, decode by model, session time by part,
     speed-up if twice as fast. The session-time figure draws the paper's
     four parts, prefill, decode, tool and user idle, from the same
     per-session time breakdown the speed-up query computes (trusted TTFTs
     split prefill from decode, unsplit latency shared by the session's
     ratio, tool waits capped), with a parity test against the paper's
     mean shares; one query computes the breakdown and both figures read
     it, so the definition has one home.
   - Tools: latency by category, result size by category, calls per
     request, latency by batch width, tool mix along a turn.
   - Prefix caching: hit ratio by gap bin, hit ratio after an idle gap,
     gap by cause, mean hit ratio by cause, hit ratio after a context
     change, context mutations by cause, prefill against storage, API
     cost by TTL, infrastructure cost by TTL.
   - Human-driven against benchmark: turn duration, session duration,
     input per request, user prompt size (the two scope CDFs that have a
     human-driven twin above keep their place here; the figure count
     stays 29 plus the two histograms).
   Each card: title, caption of at most twelve words, the definition of at
   most forty words and the rows behind the control.
6. **Session list**: the table, sorted by start date descending, with
   one row of plain form controls: a month drop-down, a harness drop-down
   (the benchmark replay named as such), a model drop-down, the search
   box and the minimum-requests field; no pills, no buttons, no folded
   disclosure. Every harness is listed by default, the benchmark replay
   marked in its cell. Columns: Session, Started, Harness,
   Model, Requests, Turns, Duration, Input tokens, Cached share. A sticky
   header row inside the wrap; no sticky first column.
7. **Cite**: the BibTeX of the paper in a block with a copy button, as
   Open Data does.
8. **Team**: "Harvard MadSys and collaborators", the paper's authors with
   their affiliations, and a one-paragraph About with the links to the
   dataset, the code, Open Data and FreeInference.
9. **Footer**: Open Data's footer: the brand line, the on-site and
   elsewhere links, the Harvard copyright and policy links.

The About page's content goes three ways: definitions stay behind each
card's control; "where the site draws more simply than the paper" moves
to `docs/differences.md` in the repository, where the parity tests'
readers look; the restating-queries check moves from the About test into
`tests/test_pipeline_mirrors.py`, which already reads the queries.

## The look

Open Data's tokens, light only: paper `#f8f7f5`, surface white, ink
`#1c1917`, rule `#e4dfdb`, crimson `#a51c30` with its dark and tint;
Crimson Text for headings, stat numbers and the affiliation; Inter for
body; the monospace stack, uppercase and letter-spaced, for eyebrows,
chips, nav and the cite caption. Cards keep a 1px rule, a soft shadow and
a 0.9rem radius; figure sections keep the 240 px charts. Dark mode stays under `prefers-color-scheme`, with a dark paper and
surfaces retuned from Open Data's inks, and the eight series slots
redrawn in both modes for more contrast and more colour: every slot at
least 3:1 against its mode's card, hues spread evenly, the two modes'
slots the same hue so a series keeps its identity; the part colours
(prefill blue, decode orange, tool green, user red, as the paper's
Figure 4c) and the token-part colours derive from the slots. A script
under `tests/` checks the contrast of every token in both modes.

The hues are not evenly spread. Four are the paper's (blue, orange, green
and red), and the paper's red and orange stand only 26° apart in OKLCH;
the slots keep them at 18° and 50°, so 30° is the floor between any two,
and amber (90°), teal, violet and magenta fill the wheel around them.
Equal lightness would make orange, amber and green one colour to a
red-green colour-blind reader, so lightness varies where it must: amber
is deeper in light (5:1) and brighter in dark (8:1), blue and teal a step
deeper in both. The test checks every pair of slots under a deuteranopia
simulation as well as the contrast and the hue floor.

## The Session page

The title row holds the breadcrumb, the id and, on the right, one facts
card: a two-column list of labelled fields (harness, models with their
request counts, started, duration, turns, requests, subagents, tool
calls, input tokens, cached share, output tokens). Below it the view tabs
and the view. The token parts everywhere on the page are cached input,
uncached input and output; a request whose provider reports no cache
reads counts its whole input as uncached, and the "no cache report"
series and label go. The drawn parts count unreported input as uncached,
while the facts card's "Cached share (reported)" stays the pipeline's and
the Explore list's ratio: cached tokens over the input of requests whose
provider reports cache reads.

The Context and Timeline views get a range slider under the chart: two
handles over the session's elapsed time, drawn as a small brush strip;
moving them sets the x domain and redraws the view, with ticks computed
for the range (`elapsedTicks` takes a start and an end). The Requests view
is unchanged. The "[object Object]" seen in the Models tile was a stale
cached `tiles.js` against a newer `facts.js`; the facts card replaces
both and the module names change, so a cached copy cannot mix again.

## Text budget

Captions at most twelve words, definitions at most forty, no section
intro, the lede one sentence, the hero title one line of two phrases:
`tests/figure_sections.test.js` counts them. Every visitor-facing string
removed with the About page that still mattered (the benchmark harness's
meaning, the data's build) is kept in one sentence where it is needed: the
benchmark mark's tooltip, the stats strip's simulation line, the Team's
About paragraph.
