# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px, light and dark. No query
and no data change is expected.

## 1. Order and names
- [ ] 1.1 Reorder `index.html`: Overview, then the sessions section (eyebrow "Sessions", heading "Browse every session", anchor `#sessions`), then the findings (eyebrow "Findings", heading "What the trace shows", anchor `#findings`, topics `#findings-sessions` … `#findings-comparison`, topic 01 titled "Session structure"); `SECTIONS` reads Overview, Sessions, Findings, Cite; the hero's primary button reads "Explore the findings" and links to `#findings`; the Session page's back link and every test and doc that names the old anchors or labels follow.

## 2. The finding line and the topic takeaway
- [ ] 2.1 `renderFigure` takes `finding`, a line rendered under the title before the chart as `.figure-finding`, its leading number-phrase in the strong weight and the rest plain; the topic heading takes a `takeaway` sentence rendered under the heading as `.topic-takeaway`; CSS for both in the Open Data look at 1280 and 360 px, both schemes; the node test counting caption words also counts a finding (≤ 16 words) and a takeaway (≤ 25 words).
- [ ] 2.2 `tests/findings.test.js`: for every figure entry with a `finding`, the entry names `findingNumbers(answer)` returning the numbers its text states, in the text's format; the test reads the shipped answer, formats each number with the site's formatters and asserts the text contains it; a finding with no number needs no function. The pattern is written up in CONTRIBUTING under adding a figure.

## 3. The findings, by topic (the texts and the functions are in design.md)
- [ ] 3.1 Session structure: the four cards' findings and the topic takeaway.
- [ ] 3.2 Tokens and cost: six cards and the takeaway.
- [ ] 3.3 Latency: four cards and the takeaway.
- [ ] 3.4 Tools: five cards and the takeaway.
- [ ] 3.5 Prefix caching: nine cards and the takeaway.
- [ ] 3.6 Human-driven against benchmark: four cards (user prompt size included) and the takeaway; `docs/differences.md` lists every finding whose number differs from the paper's sentence and why.

## 4. Close
- [ ] 4.1 README (page table, layout lines, the section list), CONTRIBUTING (the figure entry pattern with `finding` and `findingNumbers`), `openspec validate insights --strict`, a browser pass over the landing page at 1280 and 360 px in both schemes, measurements refreshed if the request count changed.
