# Tasks

Every task ends with `make test` green and one commit. A task that touches
a view checks it in a browser at 1280 and 360 px, light and dark. No query
and no data change is expected.

## 1. Order and names
- [x] 1.1 Reorder `index.html`: Overview, then Session Explorer (anchor `#sessions`), then Insights (anchor `#insights`, topics `#insights-sessions` … `#insights-comparison`, topic 01 titled "Session structure"), then Cite; each section one heading and no eyebrow; `SECTIONS` reads Overview, Session Explorer, Insights, Cite; the hero's primary button reads "Insights" and links to `#insights`; the Session page's back link reads "← Session Explorer"; every test and doc that names the old anchors or labels follows.
- [x] 1.2 The name and the footer: the hero's title is "FreeInference Agentic Dataset" (the second phrase in the accent), no eyebrow above it, the week count folded into the lede's first clause; the header and footer brand reads "FreeInference Agentic Dataset"; the footer keeps the brand line and the on-site and elsewhere links and loses the copyright line and the policy links; the `URLS` entries only they used go.

## 2. The insight line and the topic takeaway
- [x] 2.1 `renderFigure` takes `insight`, a sentence rendered under the title before the legend as `.figure-insight`; each topic heading takes a `takeaway` sentence rendered under it as `.topic-takeaway`; CSS for both in the Open Data look at 1280 and 360 px, both schemes; the node test that counts caption words also counts an insight (≤ 12 words) and a takeaway (≤ 20 words), and fails on a card without an insight.

## 3. The insights, by topic (the sentences are in design.md §4)
- [ ] 3.1 Session structure and Tokens and cost: ten cards and two takeaways.
- [ ] 3.2 Latency and Tools: nine cards and two takeaways.
- [ ] 3.3 Prefix caching and Human-driven against benchmark: twelve cards and two takeaways.

## 4. Close
- [ ] 4.1 README (page table, layout lines, section names), CONTRIBUTING (the figure entry pattern with `insight`), `openspec validate insights --strict`, a browser pass over the landing page at 1280 and 360 px in both schemes.
